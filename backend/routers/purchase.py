from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Project, PurchaseRefStage, PurchaseRefSubgroup, PurchaseRefItem, SelectedPurchase, PurchasedItem, PriceCategory, PriceModel
from ..schemas import PurchaseRefStageOut, PurchaseRefSubgroupOut, PurchaseRefItemOut, CustomPurchaseCreate, AddToCompareRequest
from ..auth import get_current_user
import uuid

router = APIRouter(tags=["Purchase"])


@router.get("/api/purchase/references", response_model=list[PurchaseRefStageOut])
async def get_references(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PurchaseRefStage))
    stages = result.scalars().all()
    out = []
    for stage in stages:
        subs_result = await db.execute(select(PurchaseRefSubgroup).where(PurchaseRefSubgroup.stage_id == stage.id))
        subs = []
        for sub in subs_result.scalars().all():
            items_result = await db.execute(select(PurchaseRefItem).where(PurchaseRefItem.subgroup_id == sub.id))
            items = [PurchaseRefItemOut.model_validate(it) for it in items_result.scalars().all()]
            subs.append(PurchaseRefSubgroupOut(name=sub.name, items=items))
        out.append(PurchaseRefStageOut(parent=stage.parent, subs=subs))
    if not out:
        return []
    return out


@router.get("/api/projects/{project_id}/purchase/selected", response_model=list[str])
async def get_selected(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SelectedPurchase).where(SelectedPurchase.project_id == project_id))
    return [sp.item_id for sp in result.scalars().all()]


@router.put("/api/projects/{project_id}/purchase/selected/{item_id}")
async def toggle_selected(project_id: str, item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Verify project ownership
    proj = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")

    result = await db.execute(select(SelectedPurchase).where(SelectedPurchase.project_id == project_id, SelectedPurchase.item_id == item_id))
    existing = result.scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()
        return {"selected": False}
    else:
        sp = SelectedPurchase(id=f"sp_{uuid.uuid4().hex[:12]}", project_id=project_id, item_id=item_id)
        db.add(sp)
        await db.commit()
        return {"selected": True}


@router.post("/api/projects/{project_id}/purchase/custom")
async def add_custom_item(project_id: str, data: CustomPurchaseCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Verify project ownership
    proj = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")

    # Find the stage by parent name
    stage_result = await db.execute(select(PurchaseRefStage).where(PurchaseRefStage.parent == data.stage_parent))
    stage = stage_result.scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=404, detail="采购阶段不存在")

    # Find the subgroup — by name if provided, otherwise use first subgroup
    sub = None
    if data.subgroup_name:
        sub_result = await db.execute(
            select(PurchaseRefSubgroup).where(
                PurchaseRefSubgroup.stage_id == stage.id,
                PurchaseRefSubgroup.name == data.subgroup_name,
            )
        )
        sub = sub_result.scalar_one_or_none()
    if not sub:
        sub_result = await db.execute(select(PurchaseRefSubgroup).where(PurchaseRefSubgroup.stage_id == stage.id).limit(1))
        sub = sub_result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="子分组不存在")

    item = PurchaseRefItem(
        id=f"p_custom_{uuid.uuid4().hex[:12]}",
        subgroup_id=sub.id,
        name=data.name,
        spec=data.spec or "",
        qty=data.qty,
        unit=data.unit or "个",
    )
    db.add(item)
    # Auto-select
    sp = SelectedPurchase(id=f"sp_{uuid.uuid4().hex[:12]}", project_id=project_id, item_id=item.id)
    db.add(sp)
    await db.commit()
    return {"id": item.id, "name": item.name, "spec": item.spec, "qty": item.qty, "unit": item.unit, "selected": True}


@router.delete("/api/projects/{project_id}/purchase/items/{item_id}", status_code=204)
async def delete_purchase_item(project_id: str, item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Verify project ownership
    proj = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")

    # Remove selection
    sel_result = await db.execute(select(SelectedPurchase).where(SelectedPurchase.project_id == project_id, SelectedPurchase.item_id == item_id))
    for sp in sel_result.scalars().all():
        await db.delete(sp)
    # Only remove custom items (not reference items)
    item_result = await db.execute(select(PurchaseRefItem).where(PurchaseRefItem.id == item_id))
    item = item_result.scalar_one_or_none()
    if item and item.id.startswith("p_custom_"):
        await db.delete(item)
    await db.commit()


# ── Purchased status ──

@router.get("/api/projects/{project_id}/purchase/purchased", response_model=list[str])
async def get_purchased(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PurchasedItem).where(PurchasedItem.project_id == project_id))
    return [pi.item_id for pi in result.scalars().all()]


@router.put("/api/projects/{project_id}/purchase/purchased/{item_id}")
async def toggle_purchased(project_id: str, item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    proj = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")

    result = await db.execute(select(PurchasedItem).where(PurchasedItem.project_id == project_id, PurchasedItem.item_id == item_id))
    existing = result.scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()
        return {"purchased": False}
    else:
        pi = PurchasedItem(id=f"pi_{uuid.uuid4().hex[:12]}", project_id=project_id, item_id=item_id)
        db.add(pi)
        await db.commit()
        return {"purchased": True}


# ── Add purchase item to compare ──

@router.post("/api/projects/{project_id}/purchase/add-to-compare", status_code=201)
async def add_purchase_to_compare(project_id: str, data: AddToCompareRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    proj = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")

    # Find or create PriceCategory matching the stage parent name
    cat_result = await db.execute(select(PriceCategory).where(PriceCategory.project_id == project_id, PriceCategory.name == data.category_name))
    cat = cat_result.scalar_one_or_none()
    if not cat:
        cat = PriceCategory(id=f"pc_{uuid.uuid4().hex[:12]}", project_id=project_id, name=data.category_name, icon="📦")
        db.add(cat)
        await db.flush()

    # Create PriceModel
    model = PriceModel(
        id=f"pm_{uuid.uuid4().hex[:12]}",
        category_id=cat.id,
        name=data.item_name,
        spec=data.spec or "",
        quantity=data.quantity,
    )
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return {"category_id": cat.id, "model_id": model.id, "name": model.name}
