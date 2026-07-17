from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models import User, Project
from ..schemas import AppStateSync
from ..auth import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}/sync", tags=["Sync"])


def _scoped_project_id(raw_project_id: str, user_id: str) -> str:
    """Scope a frontend project ID (like 'p1') to the current user."""
    scope = user_id.replace("-", "")[:8]
    return f"{raw_project_id}_{scope}"


async def _ensure_project(project_id: str, user: User, db: AsyncSession) -> Project:
    """Return the project if it belongs to the user; auto-create if missing."""
    from sqlalchemy import select
    scoped_id = _scoped_project_id(project_id, user.id)
    result = await db.execute(
        select(Project).where(Project.id == scoped_id, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if project:
        return project
    project = Project(
        id=scoped_id, user_id=user.id, name="默认项目",
        owner_name=user.username or "我",
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.post("/export")
async def export_state(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Export all project data as JSON (same format as frontend localStorage)."""
    from sqlalchemy import select
    from ..models import Todo, Expense, Budget, BudgetCategory, FlowProgress, PriceCategory, PriceModel, ChannelQuote, SelectedPurchase, SyncedModel, StageNote, CustomFlowStep, PurchasedItem

    proj = await _ensure_project(project_id, user, db)
    sid = proj.id  # scoped project ID

    todos = (await db.execute(select(Todo).where(Todo.project_id == sid))).scalars().all()
    expenses = (await db.execute(select(Expense).where(Expense.project_id == sid))).scalars().all()

    budget_result = await db.execute(select(Budget).where(Budget.project_id == sid))
    budget = budget_result.scalar_one_or_none()
    cats = (await db.execute(select(BudgetCategory).where(BudgetCategory.project_id == sid))).scalars().all()

    fp = (await db.execute(select(FlowProgress).where(FlowProgress.project_id == sid))).scalar_one_or_none()

    # Export price categories (deprecated compat) + direct price_models
    price_cats = (await db.execute(select(PriceCategory).where(PriceCategory.project_id == sid))).scalars().all()
    price_data = []
    for pc in price_cats:
        models = (await db.execute(select(PriceModel).where(PriceModel.category_id == pc.id))).scalars().all()
        models_data = []
        for m in models:
            quotes = (await db.execute(select(ChannelQuote).where(ChannelQuote.model_id == m.id))).scalars().all()
            models_data.append({"id": m.id, "name": m.name, "spec": m.spec, "note": m.note, "quantity": m.quantity,
                "item_id": m.item_id, "project_id": m.project_id,
                "channelQuotes": [{"id": q.id, "channel": q.channel, "price": q.price, "url": q.url, "updatedAt": q.updated_at.isoformat() if q.updated_at else None} for q in quotes]})
        price_data.append({"id": pc.id, "name": pc.name, "icon": pc.icon,
            "purchase_item_id": pc.purchase_item_id, "best_quote_id": pc.best_quote_id,
            "models": models_data})

    # Export direct price_models (new format, keyed by item_id)
    direct_models = (await db.execute(
        select(PriceModel).where(PriceModel.project_id == sid, PriceModel.item_id != None)
    )).scalars().all()
    price_models_data = []
    for m in direct_models:
        quotes = (await db.execute(select(ChannelQuote).where(ChannelQuote.model_id == m.id))).scalars().all()
        price_models_data.append({
            "id": m.id, "item_id": m.item_id, "project_id": m.project_id,
            "name": m.name, "spec": m.spec, "note": m.note, "quantity": m.quantity,
            "channelQuotes": [{"id": q.id, "channel": q.channel, "price": q.price, "url": q.url, "updatedAt": q.updated_at.isoformat() if q.updated_at else None} for q in quotes],
        })

    sel = (await db.execute(select(SelectedPurchase).where(SelectedPurchase.project_id == sid))).scalars().all()
    purch = (await db.execute(select(PurchasedItem).where(PurchasedItem.project_id == sid))).scalars().all()
    synced = (await db.execute(select(SyncedModel).where(SyncedModel.project_id == sid))).scalars().all()

    # Stage notes
    notes = (await db.execute(select(StageNote).where(StageNote.project_id == sid))).scalars().all()
    notes_by_stage: dict = {}
    for n in notes:
        notes_by_stage.setdefault(n.stage_id, []).append({
            "id": n.id, "project_id": n.project_id, "stage_id": n.stage_id,
            "content": n.content, "created_at": n.created_at.isoformat(),
        })

    # Custom flow steps
    custom_steps = (await db.execute(select(CustomFlowStep).where(CustomFlowStep.project_id == sid))).scalars().all()
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
        "priceModels": price_models_data,
        "selectedPurchaseIds": [s.item_id for s in sel],
        "purchasedItemIds": [p.item_id for p in purch],
        "syncedModelIds": [s.model_id for s in synced],
        "stageNotes": notes_by_stage,
        "customFlowSteps": custom_steps_data,
    }


@router.post("/import")
async def import_state(project_id: str, data: AppStateSync, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Import full project state from JSON."""
    from sqlalchemy import select, delete
    from ..models import Todo, Expense, Budget, BudgetCategory, FlowProgress, PriceCategory, PriceModel, ChannelQuote, SelectedPurchase, SyncedModel, StageNote, CustomFlowStep, PurchasedItem
    import uuid
    from datetime import date as date_type, datetime, timezone

    proj = await _ensure_project(project_id, user, db)
    sid = proj.id  # scoped project ID

    # Clear existing data
    for model in [Todo, Expense, SelectedPurchase, PurchasedItem, SyncedModel, StageNote, CustomFlowStep]:
        await db.execute(delete(model).where(model.project_id == sid))
    await db.execute(delete(Budget).where(Budget.project_id == sid))
    await db.execute(delete(BudgetCategory).where(BudgetCategory.project_id == sid))
    await db.execute(delete(FlowProgress).where(FlowProgress.project_id == sid))
    # Clear price categories
    existing_pc = (await db.execute(select(PriceCategory).where(PriceCategory.project_id == sid))).scalars().all()
    for pc in existing_pc:
        await db.delete(pc)

    # Import todos
    for t in data.todos:
        db.add(Todo(id=t.get("id", f"todo_{uuid.uuid4().hex[:12]}"), project_id=sid, title=t["title"], stage_id=t.get("stage_id", "design"),
            due_date=date_type.fromisoformat(t["due_date"]) if t.get("due_date") else None, completed=t.get("completed", False)))

    # Import expenses
    for e in data.expenses:
        db.add(Expense(id=e.get("id", f"exp_{uuid.uuid4().hex[:12]}"), project_id=sid, title=e["title"], amount=e["amount"],
            category_id=e.get("category_id", "hard"), stage_id=e.get("stage_id"),
            date=date_type.fromisoformat(e["date"]) if e.get("date") else date_type.today(),
            status=e.get("status", "paid"), payer=e.get("payer"), note=e.get("note")))

    # Import budget
    if data.budget:
        db.add(Budget(project_id=sid, total=data.budget.get("total", 0.0)))
        for c in data.budget.get("categories", []):
            db.add(BudgetCategory(id=f"{sid}_{c['id']}", project_id=sid, name=c["name"], color=c.get("color", "#999"), allocated=c.get("allocated", 0.0), spent=c.get("spent", 0.0)))

    # Import flow
    if data.flow_progress:
        fp = data.flow_progress
        db.add(FlowProgress(project_id=sid, flow_type=fp.get("flow_type", "new"),
            done_step_ids=fp.get("done_step_ids", []), custom_order=fp.get("custom_order")))

    # Import stage notes
    if data.stage_notes:
        for stage_id, note_list in data.stage_notes.items():
            for n in note_list:
                db.add(StageNote(
                    id=n.get("id", f"sn_{uuid.uuid4().hex[:12]}"),
                    project_id=sid,
                    stage_id=stage_id,
                    content=n["content"],
                ))

    # Import custom flow steps
    for cs in data.custom_flow_steps:
        db.add(CustomFlowStep(
            id=cs.get("id", f"cs_{uuid.uuid4().hex[:12]}"),
            project_id=sid,
            flow_type=cs.get("flow_type", "new"),
            title=cs["title"],
            days=cs.get("days", ""),
            desc=cs.get("desc", ""),
            sort_order=cs.get("sort_order", 0),
        ))

    # Import price categories (deprecated compat)
    for pc in data.price_categories:
        cat = PriceCategory(
            id=pc.get("id", f"pc_{uuid.uuid4().hex[:12]}"),
            project_id=project_id,
            name=pc["name"],
            icon=pc.get("icon", "📦"),
            purchase_item_id=pc.get("purchase_item_id"),
            best_quote_id=pc.get("best_quote_id"),
        )
        db.add(cat)
        for m in pc.get("models", []):
            model = PriceModel(id=m.get("id", f"pm_{uuid.uuid4().hex[:12]}"),
                category_id=cat.id, item_id=m.get("item_id"), project_id=m.get("project_id", sid),
                name=m["name"], spec=m.get("spec"), note=m.get("note"), quantity=m.get("quantity", 1))
            db.add(model)
            for q in m.get("channelQuotes", []):
                db.add(ChannelQuote(id=q.get("id", f"ch_{uuid.uuid4().hex[:12]}"), model_id=model.id, channel=q["channel"], price=q.get("price"), url=q.get("url")))

    # Import direct price_models (new format)
    for pm in data.price_models:
        model = PriceModel(
            id=pm.get("id", f"pm_{uuid.uuid4().hex[:12]}"),
            item_id=pm.get("item_id"), project_id=pm.get("project_id", sid),
            name=pm["name"], spec=pm.get("spec"), note=pm.get("note"), quantity=pm.get("quantity", 1),
        )
        db.add(model)
        for q in pm.get("channelQuotes", []):
            db.add(ChannelQuote(id=q.get("id", f"ch_{uuid.uuid4().hex[:12]}"), model_id=model.id, channel=q["channel"], price=q.get("price"), url=q.get("url")))

    # Import selections
    for sid in data.selected_purchase_ids:
        db.add(SelectedPurchase(id=f"sp_{uuid.uuid4().hex[:12]}", project_id=project_id, item_id=sid))
    for pid in data.purchased_item_ids:
        db.add(PurchasedItem(id=f"pi_{uuid.uuid4().hex[:12]}", project_id=project_id, item_id=pid))
    for mid in data.synced_model_ids:
        db.add(SyncedModel(id=f"sm_{uuid.uuid4().hex[:12]}", project_id=project_id, model_id=mid))

    await db.commit()
    return {"status": "ok"}
