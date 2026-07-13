from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models import User, Project
from ..schemas import AppStateSync
from ..auth import get_current_user_or_guest

router = APIRouter(prefix="/api/projects/{project_id}/sync", tags=["Sync"])


async def _ensure_project(project_id: str, user: User, db: AsyncSession) -> Project:
    """Return the project if it belongs to the user; create it for guest if missing."""
    from sqlalchemy import select
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if project:
        return project
    if user.id == "guest":
        project = Project(id=project_id, user_id=user.id, name="默认项目", owner_name="游客")
        db.add(project)
        await db.commit()
        await db.refresh(project)
        return project
    raise HTTPException(status_code=404, detail="项目不存在")


@router.post("/export")
async def export_state(project_id: str, user: User = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)):
    """Export all project data as JSON (same format as frontend localStorage)."""
    from sqlalchemy import select
    from ..models import Todo, Expense, Budget, BudgetCategory, FlowProgress, PriceCategory, PriceModel, ChannelQuote, SelectedPurchase, SyncedModel, StageNote, CustomFlowStep

    proj = await _ensure_project(project_id, user, db)

    todos = (await db.execute(select(Todo).where(Todo.project_id == project_id))).scalars().all()
    expenses = (await db.execute(select(Expense).where(Expense.project_id == project_id))).scalars().all()

    budget_result = await db.execute(select(Budget).where(Budget.project_id == project_id))
    budget = budget_result.scalar_one_or_none()
    cats = (await db.execute(select(BudgetCategory).where(BudgetCategory.project_id == project_id))).scalars().all()

    fp = (await db.execute(select(FlowProgress).where(FlowProgress.project_id == project_id))).scalar_one_or_none()

    price_cats = (await db.execute(select(PriceCategory).where(PriceCategory.project_id == project_id))).scalars().all()
    price_data = []
    for pc in price_cats:
        models = (await db.execute(select(PriceModel).where(PriceModel.category_id == pc.id))).scalars().all()
        models_data = []
        for m in models:
            quotes = (await db.execute(select(ChannelQuote).where(ChannelQuote.model_id == m.id))).scalars().all()
            models_data.append({"id": m.id, "name": m.name, "spec": m.spec, "note": m.note, "quantity": m.quantity,
                "channelQuotes": [{"id": q.id, "channel": q.channel, "price": q.price, "url": q.url, "updatedAt": q.updated_at.isoformat() if q.updated_at else None} for q in quotes]})
        price_data.append({"id": pc.id, "name": pc.name, "icon": pc.icon, "models": models_data})

    sel = (await db.execute(select(SelectedPurchase).where(SelectedPurchase.project_id == project_id))).scalars().all()
    synced = (await db.execute(select(SyncedModel).where(SyncedModel.project_id == project_id))).scalars().all()

    # Stage notes
    notes = (await db.execute(select(StageNote).where(StageNote.project_id == project_id))).scalars().all()
    notes_by_stage: dict = {}
    for n in notes:
        notes_by_stage.setdefault(n.stage_id, []).append({
            "id": n.id, "project_id": n.project_id, "stage_id": n.stage_id,
            "content": n.content, "created_at": n.created_at.isoformat(),
        })

    # Custom flow steps
    custom_steps = (await db.execute(select(CustomFlowStep).where(CustomFlowStep.project_id == project_id))).scalars().all()
    custom_steps_data = [{
        "id": cs.id, "project_id": cs.project_id, "flow_type": cs.flow_type,
        "title": cs.title, "days": cs.days, "desc": cs.desc,
        "sort_order": cs.sort_order, "created_at": cs.created_at.isoformat(),
    } for cs in custom_steps]

    return {
        "projects": [{"id": proj.id, "name": proj.name, "ownerName": proj.owner_name, "createdAt": proj.created_at.isoformat(), "currentStageId": proj.current_stage_id}],
        "activeProjectId": project_id,
        "todos": [{"id": t.id, "projectId": t.project_id, "title": t.title, "stageId": t.stage_id, "dueDate": t.due_date.isoformat() if t.due_date else None, "completed": t.completed, "createdAt": t.created_at.isoformat()} for t in todos],
        "expenses": [{"id": e.id, "projectId": e.project_id, "title": e.title, "amount": e.amount, "categoryId": e.category_id, "stageId": e.stage_id, "date": e.date.isoformat(), "status": e.status, "payer": e.payer, "note": e.note, "createdAt": e.created_at.isoformat()} for e in expenses],
        "recentExpenses": [{"id": e.id, "projectId": e.project_id, "title": e.title, "amount": e.amount, "categoryId": e.category_id, "stageId": e.stage_id, "date": e.date.isoformat(), "status": e.status, "payer": e.payer, "note": e.note, "createdAt": e.created_at.isoformat()} for e in expenses[:5]],
        "budget": {
            "total": budget.total if budget else 0.0,
            "spent": sum(c.spent for c in cats),
            "categories": [{"id": c.id, "name": c.name, "color": c.color, "allocated": c.allocated, "spent": c.spent} for c in cats],
        },
        "flowType": fp.flow_type if fp else "new",
        "flowDoneStepIds": fp.done_step_ids if fp else [],
        "flowCustomOrder": fp.custom_order if fp else None,
        "priceCategories": price_data,
        "selectedPurchaseIds": [s.item_id for s in sel],
        "syncedModelIds": [s.model_id for s in synced],
        "stageNotes": notes_by_stage,
        "customFlowSteps": custom_steps_data,
    }


@router.post("/import")
async def import_state(project_id: str, data: AppStateSync, user: User = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)):
    """Import full project state from JSON."""
    from sqlalchemy import select, delete
    from ..models import Todo, Expense, Budget, BudgetCategory, FlowProgress, PriceCategory, PriceModel, ChannelQuote, SelectedPurchase, SyncedModel, StageNote, CustomFlowStep
    import uuid
    from datetime import date as date_type, datetime, timezone

    await _ensure_project(project_id, user, db)

    # Clear existing data
    for model in [Todo, Expense, SelectedPurchase, SyncedModel, StageNote, CustomFlowStep]:
        await db.execute(delete(model).where(model.project_id == project_id))
    await db.execute(delete(Budget).where(Budget.project_id == project_id))
    await db.execute(delete(BudgetCategory).where(BudgetCategory.project_id == project_id))
    await db.execute(delete(FlowProgress).where(FlowProgress.project_id == project_id))
    # Clear price categories
    existing_pc = (await db.execute(select(PriceCategory).where(PriceCategory.project_id == project_id))).scalars().all()
    for pc in existing_pc:
        await db.delete(pc)

    # Import todos
    for t in data.todos:
        db.add(Todo(id=t.get("id", f"todo_{uuid.uuid4().hex[:12]}"), project_id=project_id, title=t["title"], stage_id=t.get("stage_id", "design"),
            due_date=date_type.fromisoformat(t["due_date"]) if t.get("due_date") else None, completed=t.get("completed", False)))

    # Import expenses
    for e in data.expenses:
        db.add(Expense(id=e.get("id", f"exp_{uuid.uuid4().hex[:12]}"), project_id=project_id, title=e["title"], amount=e["amount"],
            category_id=e.get("category_id", "hard"), stage_id=e.get("stage_id"),
            date=date_type.fromisoformat(e["date"]) if e.get("date") else date_type.today(),
            status=e.get("status", "paid"), payer=e.get("payer"), note=e.get("note")))

    # Import budget
    if data.budget:
        db.add(Budget(project_id=project_id, total=data.budget.get("total", 0.0)))
        for c in data.budget.get("categories", []):
            db.add(BudgetCategory(id=f"{project_id}_{c['id']}", project_id=project_id, name=c["name"], color=c.get("color", "#999"), allocated=c.get("allocated", 0.0), spent=c.get("spent", 0.0)))

    # Import flow
    if data.flow_progress:
        fp = data.flow_progress
        db.add(FlowProgress(project_id=project_id, flow_type=fp.get("flow_type", "new"),
            done_step_ids=fp.get("done_step_ids", []), custom_order=fp.get("custom_order")))

    # Import stage notes
    if data.stage_notes:
        for stage_id, note_list in data.stage_notes.items():
            for n in note_list:
                db.add(StageNote(
                    id=n.get("id", f"sn_{uuid.uuid4().hex[:12]}"),
                    project_id=project_id,
                    stage_id=stage_id,
                    content=n["content"],
                ))

    # Import custom flow steps
    for cs in data.custom_flow_steps:
        db.add(CustomFlowStep(
            id=cs.get("id", f"cs_{uuid.uuid4().hex[:12]}"),
            project_id=project_id,
            flow_type=cs.get("flow_type", "new"),
            title=cs["title"],
            days=cs.get("days", ""),
            desc=cs.get("desc", ""),
            sort_order=cs.get("sort_order", 0),
        ))

    # Import price categories
    for pc in data.price_categories:
        cat = PriceCategory(id=pc.get("id", f"pc_{uuid.uuid4().hex[:12]}"), project_id=project_id, name=pc["name"], icon=pc.get("icon", "📦"))
        db.add(cat)
        for m in pc.get("models", []):
            model = PriceModel(id=m.get("id", f"pm_{uuid.uuid4().hex[:12]}"), category_id=cat.id, name=m["name"], spec=m.get("spec"), note=m.get("note"), quantity=m.get("quantity", 1))
            db.add(model)
            for q in m.get("channelQuotes", []):
                db.add(ChannelQuote(id=q.get("id", f"ch_{uuid.uuid4().hex[:12]}"), model_id=model.id, channel=q["channel"], price=q.get("price"), url=q.get("url")))

    # Import selections
    for sid in data.selected_purchase_ids:
        db.add(SelectedPurchase(id=f"sp_{uuid.uuid4().hex[:12]}", project_id=project_id, item_id=sid))
    for mid in data.synced_model_ids:
        db.add(SyncedModel(id=f"sm_{uuid.uuid4().hex[:12]}", project_id=project_id, model_id=mid))

    await db.commit()
    return {"status": "ok"}
