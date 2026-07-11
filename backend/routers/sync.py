from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models import User, Project
from ..schemas import AppStateSync
from ..auth import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}/sync", tags=["Sync"])


@router.post("/export")
async def export_state(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Export all project data as JSON (same format as frontend localStorage)."""
    from sqlalchemy import select
    from ..models import Todo, Expense, Budget, BudgetCategory, FlowProgress, PriceCategory, PriceModel, ChannelQuote, SelectedPurchase, SyncedModel

    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")

    # Gather all data
    proj = result.scalar_one()

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
    }


@router.post("/import")
async def import_state(project_id: str, data: AppStateSync, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Import full project state from JSON."""
    from sqlalchemy import select, delete
    from ..models import Todo, Expense, Budget, BudgetCategory, FlowProgress, PriceCategory, PriceModel, ChannelQuote, SelectedPurchase, SyncedModel
    import uuid
    from datetime import date as date_type, datetime, timezone

    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")

    # Clear existing data
    for model in [Todo, Expense, SelectedPurchase, SyncedModel]:
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
