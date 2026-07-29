from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from ..database import get_db
from ..models import User, Project, PurchaseRefStage, PurchaseRefSubgroup, PurchaseRefItem, SelectedPurchase, PurchasedItem, PriceModel, ChannelQuote, PriceCategory, ProjectCompareItem
from ..schemas import PurchaseRefStageOut, PurchaseRefSubgroupOut, PurchaseRefItemOut, CustomPurchaseCreate, CompareItemOut, PriceModelOut, ChannelQuoteOut
from ..auth import get_current_user
from sqlalchemy import update
import uuid

router = APIRouter(tags=["Purchase"])


def _scoped_id(raw_project_id: str, user_id: str) -> str:
    """将前端项目 ID 作用域化到当前用户，实现数据隔离。

    幂等：如果 ID 已经包含当前用户的 scope 后缀则直接返回，
    避免重复追加（如 p1_b3c9f40b → p1_b3c9f40b 而非 p1_b3c9f40b_b3c9f40b）。
    """
    scope = user_id.replace("-", "")[:8]
    suffix = f"_{scope}"
    if raw_project_id.endswith(suffix):
        return raw_project_id
    return f"{raw_project_id}_{scope}"


async def _ensure_project(raw_project_id: str, user: User, db: AsyncSession) -> str:
    """确保项目存在，返回作用域化后的项目 ID。"""
    sid = _scoped_id(raw_project_id, user.id)
    result = await db.execute(
        select(Project).where(Project.id == sid, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        project = Project(id=sid, user_id=user.id, name="默认项目",
                          owner_name=user.username or "我")
        db.add(project)
        await db.commit()
        await db.refresh(project)
    return sid


@router.get("/api/purchase/references", response_model=list[PurchaseRefStageOut])
async def get_references(
    project_id: str = Query(..., description="项目ID（必填）"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """返回采购参考数据：公共物品（所有项目可见）+ 当前项目专属物品。
    同时根据 ProjectCompareItem 动态设置 needs_compare 字段。"""
    sid = _scoped_id(project_id, user.id)

    # 收集该项目已加入比价的物品 ID
    cmp_result = await db.execute(
        select(ProjectCompareItem.item_id).where(ProjectCompareItem.project_id == sid)
    )
    compare_item_ids = {row[0] for row in cmp_result.fetchall()}

    # 获取阶段，然后过滤物品：公共物品 (project_id IS NULL) 或该项目专属物品
    result = await db.execute(select(PurchaseRefStage))
    stages = result.scalars().all()
    out = []
    for stage in stages:
        subs_result = await db.execute(
            select(PurchaseRefSubgroup).where(PurchaseRefSubgroup.stage_id == stage.id)
        )
        subs = []
        for sub in subs_result.scalars().all():
            items_result = await db.execute(
                select(PurchaseRefItem).where(
                    PurchaseRefItem.subgroup_id == sub.id,
                    or_(
                        PurchaseRefItem.project_id == None,   # 公共种子数据
                        PurchaseRefItem.project_id == sid,    # 该项目专属物品
                    ),
                )
            )
            items = []
            for it in items_result.scalars().all():
                item_out = PurchaseRefItemOut(
                    id=it.id, name=it.name, spec=it.spec,
                    qty=it.qty, unit=it.unit,
                    needs_compare=it.id in compare_item_ids,
                    category_id=it.category_id,
                    sub_category_id=it.sub_category_id,
                )
                items.append(item_out)
            if items:
                subs.append(PurchaseRefSubgroupOut(name=sub.name, items=items))
        if subs:
            out.append(PurchaseRefStageOut(parent=stage.parent, subs=subs))
    return out


@router.get("/api/projects/{project_id}/purchase/selected", response_model=list[str])
async def get_selected(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(SelectedPurchase).where(SelectedPurchase.project_id == sid))
    return [sp.item_id for sp in result.scalars().all()]


@router.put("/api/projects/{project_id}/purchase/selected/{item_id}")
async def toggle_selected(project_id: str, item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)

    result = await db.execute(select(SelectedPurchase).where(SelectedPurchase.project_id == sid, SelectedPurchase.item_id == item_id))
    existing = result.scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()
        return {"selected": False}
    else:
        sp = SelectedPurchase(id=f"sp_{uuid.uuid4().hex[:12]}", project_id=sid, item_id=item_id)
        db.add(sp)
        await db.commit()
        return {"selected": True}


@router.post("/api/projects/{project_id}/purchase/custom")
async def add_custom_item(project_id: str, data: CustomPurchaseCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)

    # 查找阶段
    stage_result = await db.execute(select(PurchaseRefStage).where(PurchaseRefStage.parent == data.stage_parent))
    stage = stage_result.scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=404, detail="采购阶段不存在")

    # 查找子分组
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
        project_id=sid,  # 标记为项目专属物品
        category_id=data.category_id,
        sub_category_id=data.sub_category_id,
    )
    db.add(item)
    # 自动加入待购清单
    sp = SelectedPurchase(id=f"sp_{uuid.uuid4().hex[:12]}", project_id=sid, item_id=item.id)
    db.add(sp)
    await db.commit()
    return {"id": item.id, "name": item.name, "spec": item.spec, "qty": item.qty, "unit": item.unit, "selected": True}


@router.delete("/api/projects/{project_id}/purchase/items/{item_id}", status_code=204)
async def delete_purchase_item(project_id: str, item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)

    # 验证物品存在且属于该项目
    item_result = await db.execute(select(PurchaseRefItem).where(PurchaseRefItem.id == item_id))
    item = item_result.scalar_one_or_none()
    if not item:
        return  # 已经不存在了

    # 不允许删除公共参考物品
    if item.project_id is None:
        raise HTTPException(status_code=403, detail="不能删除公共参考项目")
    # 不允许删除其他项目的物品
    if item.project_id != sid:
        raise HTTPException(status_code=403, detail="不能删除其他项目的物品")

    # 解除 PriceCategory 关联
    await db.execute(
        update(PriceCategory).where(PriceCategory.purchase_item_id == item_id).values(purchase_item_id=None)
    )

    # 移除待购清单中的记录
    sel_result = await db.execute(select(SelectedPurchase).where(SelectedPurchase.project_id == sid, SelectedPurchase.item_id == item_id))
    for sp in sel_result.scalars().all():
        await db.delete(sp)

    # 移除比价清单中的记录
    cmp_result = await db.execute(
        select(ProjectCompareItem).where(ProjectCompareItem.project_id == sid, ProjectCompareItem.item_id == item_id)
    )
    for pci in cmp_result.scalars().all():
        await db.delete(pci)

    # 删除物品本身
    await db.delete(item)
    await db.commit()


# ── 已购状态 ──

@router.get("/api/projects/{project_id}/purchase/purchased", response_model=list[str])
async def get_purchased(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(PurchasedItem).where(PurchasedItem.project_id == sid))
    return [pi.item_id for pi in result.scalars().all()]


@router.put("/api/projects/{project_id}/purchase/purchased/{item_id}")
async def toggle_purchased(project_id: str, item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)

    result = await db.execute(select(PurchasedItem).where(PurchasedItem.project_id == sid, PurchasedItem.item_id == item_id))
    existing = result.scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()
        return {"purchased": False}
    else:
        pi = PurchasedItem(id=f"pi_{uuid.uuid4().hex[:12]}", project_id=sid, item_id=item_id)
        db.add(pi)
        await db.commit()
        return {"purchased": True}


# ── 比价开关（使用 ProjectCompareItem 表）──

@router.get("/api/projects/{project_id}/purchase/compare-ids", response_model=list[str])
async def get_project_compare_ids(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """获取项目的比价物品 ID 列表。"""
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(
        select(ProjectCompareItem.item_id).where(ProjectCompareItem.project_id == sid)
    )
    return [row[0] for row in result.fetchall()]


@router.put("/api/projects/{project_id}/purchase/toggle-compare/{item_id}")
async def toggle_purchase_compare(project_id: str, item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """切换物品的比价状态（加入/移出比价清单）。"""
    sid = await _ensure_project(project_id, user, db)

    # 验证物品存在且该项目可访问
    item_result = await db.execute(
        select(PurchaseRefItem).where(
            PurchaseRefItem.id == item_id,
            or_(
                PurchaseRefItem.project_id == None,   # 公共物品
                PurchaseRefItem.project_id == sid,    # 该项目专属物品
            ),
        )
    )
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="物品不存在或无权访问")

    # 检查是否已在比价清单中
    cmp_result = await db.execute(
        select(ProjectCompareItem).where(
            ProjectCompareItem.project_id == sid,
            ProjectCompareItem.item_id == item_id,
        )
    )
    existing = cmp_result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        needs_compare = False
    else:
        db.add(ProjectCompareItem(
            id=f"pci_{uuid.uuid4().hex[:12]}",
            project_id=sid,
            item_id=item_id,
        ))
        needs_compare = True
        # 加入比价时自动加入待购清单
        sel_result = await db.execute(
            select(SelectedPurchase).where(SelectedPurchase.project_id == sid, SelectedPurchase.item_id == item_id)
        )
        if not sel_result.scalar_one_or_none():
            db.add(SelectedPurchase(id=f"sp_{uuid.uuid4().hex[:12]}", project_id=sid, item_id=item_id))

    await db.commit()
    return {"needs_compare": needs_compare}


# ── 获取物品的比价详情 ──

@router.get("/api/projects/{project_id}/purchase/items/{item_id}/comparison", response_model=Optional[CompareItemOut])
async def get_item_comparison(project_id: str, item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)

    item_result = await db.execute(
        select(PurchaseRefItem).where(
            PurchaseRefItem.id == item_id,
            or_(
                PurchaseRefItem.project_id == None,   # 公共物品
                PurchaseRefItem.project_id == sid,    # 该项目专属物品
            ),
        )
    )
    item = item_result.scalar_one_or_none()
    if not item:
        return None

    # 获取上下文信息
    sub_result = await db.execute(select(PurchaseRefSubgroup).where(PurchaseRefSubgroup.id == item.subgroup_id))
    subgroup = sub_result.scalar_one_or_none()
    stage_parent = subgroup_name = None
    if subgroup:
        subgroup_name = subgroup.name
        stage_result = await db.execute(select(PurchaseRefStage).where(PurchaseRefStage.id == subgroup.stage_id))
        stage = stage_result.scalar_one_or_none()
        if stage: stage_parent = stage.parent

    # 获取价格型号（已按项目隔离）
    models_result = await db.execute(
        select(PriceModel).where(PriceModel.item_id == item_id, PriceModel.project_id == sid)
    )
    models_out = []
    for m in models_result.scalars().all():
        quotes_result = await db.execute(select(ChannelQuote).where(ChannelQuote.model_id == m.id))
        quotes_out = [ChannelQuoteOut.model_validate(q) for q in quotes_result.scalars().all()]
        models_out.append(PriceModelOut(
            id=m.id, item_id=m.item_id, project_id=m.project_id,
            name=m.name, spec=m.spec, note=m.note, quantity=m.quantity,
            best_quote_id=None, quotes=quotes_out,
        ))

    return CompareItemOut(
        item_id=item.id, item_name=item.name, spec=item.spec,
        qty=item.qty, unit=item.unit,
        stage_parent=stage_parent, subgroup_name=subgroup_name,
        category_id=item.category_id,
        sub_category_id=item.sub_category_id,
        models=models_out,
    )


# ── 批量修改采购物品分类 ──

from ..schemas import BatchCategoryUpdate

@router.put("/api/purchase/items/batch-category")
async def batch_update_category(
    data: BatchCategoryUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """批量更新采购物品的预算分类。
    管理员可修改所有物品（含种子数据），普通用户仅可修改自己添加的物品。"""
    # Get the user's project for scoped ID matching
    project_result = await db.execute(
        select(Project).where(Project.user_id == user.id).limit(1)
    )
    user_project = project_result.scalar_one_or_none()

    updated = 0
    skipped = 0

    for item_data in data.items:
        item_result = await db.execute(
            select(PurchaseRefItem).where(PurchaseRefItem.id == item_data.item_id)
        )
        item = item_result.scalar_one_or_none()
        if not item:
            skipped += 1
            continue

        # Permission: admin can modify all; non-admin only their own custom items
        if not user.is_admin:
            if item.project_id is None:
                skipped += 1
                continue
            if user_project and item.project_id != user_project.id:
                skipped += 1
                continue

        item.category_id = item_data.category_id
        item.sub_category_id = item_data.sub_category_id
        updated += 1

    await db.commit()
    return {"updated": updated, "skipped": skipped}
