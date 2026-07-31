from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from ..database import get_db
from ..models import User, Project, PurchaseRefStage, PurchaseRefSubgroup, PurchaseRefItem, SelectedPurchase, PurchasedItem, PriceModel, ChannelQuote, PriceCategory, ProjectCompareItem, Expense, BudgetCategory
from ..schemas import PurchaseRefStageOut, PurchaseRefSubgroupOut, PurchaseRefItemOut, CustomPurchaseCreate, CompareItemOut, PriceModelOut, ChannelQuoteOut, TogglePurchasedRequest, TogglePurchasedResponse, PurchasedItemOut, SelectedPurchaseOut
from ..auth import get_current_user
from sqlalchemy import update
import uuid
from datetime import date

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
                    price=it.price,
                )
                items.append(item_out)
            if items:
                subs.append(PurchaseRefSubgroupOut(name=sub.name, items=items))
        if subs:
            out.append(PurchaseRefStageOut(parent=stage.parent, subs=subs))
    return out


@router.get("/api/projects/{project_id}/purchase/selected", response_model=list[SelectedPurchaseOut])
async def get_selected(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(SelectedPurchase).where(SelectedPurchase.project_id == sid))
    return [SelectedPurchaseOut(item_id=sp.item_id, expense_id=sp.expense_id) for sp in result.scalars().all()]


@router.put("/api/projects/{project_id}/purchase/selected/{item_id}")
async def toggle_selected(project_id: str, item_id: str, delete_expense: bool = Query(False, description="移除待购时是否同步删除关联账单"), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)

    result = await db.execute(select(SelectedPurchase).where(SelectedPurchase.project_id == sid, SelectedPurchase.item_id == item_id))
    sel_all = result.scalars().all()
    existing = sel_all[0] if sel_all else None
    if existing:
        # ── 移出待购清单 ──
        expense_id = existing.expense_id
        if delete_expense and expense_id:
            # 同步删除关联的记账记录
            exp_result = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.project_id == sid))
            expense = exp_result.scalar_one_or_none()
            if expense:
                if expense.status in ("paid", "prepaid"):
                    cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.id == f"{sid}_{expense.category_id}"))
                    cat = cat_result.scalar_one_or_none()
                    if cat:
                        cat.spent = max(0, cat.spent - expense.amount)
                await db.delete(expense)

        for rec in sel_all:
            await db.delete(rec)
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

    price = data.price  # 用户设置的价格

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
        price=price,  # 保存价格到物品
    )
    db.add(item)

    # 若设置了价格，自动创建一笔未支付账单
    expense_id = None
    if price is not None and price > 0:
        expense_category_id = data.category_id or "hard"

        # 构建备注：规格 + 数量
        note_parts = []
        if data.spec:
            note_parts.append(data.spec)
        if data.qty and data.unit:
            note_parts.append(f"{data.qty}{data.unit}")
        elif data.qty:
            note_parts.append(str(data.qty))

        expense_id = f"exp_{uuid.uuid4().hex[:12]}"
        expense = Expense(
            id=expense_id,
            project_id=sid,
            title=data.name,
            amount=price,
            category_id=expense_category_id,
            sub_category_id=data.sub_category_id,
            stage_id=None,
            date=date.today(),
            status="unpaid",  # 待购状态，未支付
            payer=None,
            note="，".join(note_parts) if note_parts else "",
        )
        db.add(expense)

    # 自动加入待购清单，关联账单
    sp = SelectedPurchase(id=f"sp_{uuid.uuid4().hex[:12]}", project_id=sid, item_id=item.id, expense_id=expense_id)
    db.add(sp)
    await db.commit()
    return {"id": item.id, "name": item.name, "spec": item.spec, "qty": item.qty, "unit": item.unit, "selected": True, "expense_id": expense_id}


@router.delete("/api/projects/{project_id}/purchase/items/{item_id}", status_code=204)
async def delete_purchase_item(project_id: str, item_id: str, delete_expense: bool = Query(False, description="是否同步删除关联的待购账单"), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)

    # 验证物品存在且属于该项目
    item_result = await db.execute(select(PurchaseRefItem).where(PurchaseRefItem.id == item_id))
    item = item_result.scalar_one_or_none()
    if not item:
        return  # 已经不存在了

    # 不允许删除其他项目的物品
    if item.project_id is not None and item.project_id != sid:
        raise HTTPException(status_code=403, detail="不能删除其他项目的物品")

    # 公共种子物品 (project_id is None): 只解除关联（取消待购、比价），不删除物品本身
    # 自定义物品 (project_id == sid): 完全删除
    is_seed = item.project_id is None

    # 解除 PriceCategory 关联
    await db.execute(
        update(PriceCategory).where(PriceCategory.purchase_item_id == item_id).values(purchase_item_id=None)
    )

    # 移除待购清单中的记录（含关联账单处理）
    sel_result_all = await db.execute(select(SelectedPurchase).where(SelectedPurchase.project_id == sid, SelectedPurchase.item_id == item_id))
    for sp in sel_result_all.scalars().all():
        if delete_expense and sp.expense_id:
            # 同步删除关联的记账记录
            exp_result = await db.execute(select(Expense).where(Expense.id == sp.expense_id, Expense.project_id == sid))
            expense = exp_result.scalar_one_or_none()
            if expense:
                if expense.status in ("paid", "prepaid"):
                    cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.id == f"{sid}_{expense.category_id}"))
                    cat = cat_result.scalar_one_or_none()
                    if cat:
                        cat.spent = max(0, cat.spent - expense.amount)
                await db.delete(expense)
        await db.delete(sp)

    # 移除比价清单中的记录
    cmp_result = await db.execute(
        select(ProjectCompareItem).where(ProjectCompareItem.project_id == sid, ProjectCompareItem.item_id == item_id)
    )
    for pci in cmp_result.scalars().all():
        await db.delete(pci)

    # 删除物品本身（仅自定义物品；公共种子物品保留）
    if not is_seed:
        await db.delete(item)

    await db.commit()


# ── 已购状态 ──

@router.get("/api/projects/{project_id}/purchase/purchased", response_model=list[PurchasedItemOut])
async def get_purchased(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(PurchasedItem).where(PurchasedItem.project_id == sid))
    # Deduplicate by item_id: keep the record with expense_id when duplicates exist
    best: dict[str, PurchasedItem] = {}
    for pi in result.scalars().all():
        if pi.item_id not in best or (pi.expense_id and not best[pi.item_id].expense_id):
            best[pi.item_id] = pi
    return [PurchasedItemOut(item_id=pi.item_id, expense_id=pi.expense_id) for pi in best.values()]


@router.put("/api/projects/{project_id}/purchase/purchased/{item_id}", response_model=TogglePurchasedResponse)
async def toggle_purchased(project_id: str, item_id: str, data: TogglePurchasedRequest = TogglePurchasedRequest(), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """切换已购状态。

    添加至已购时：
    - 如果提供了 price，同步保存到采购参考物品
    - 如果提供了 category_id，同步保存到采购参考物品
    - 自动创建一条记账记录（标题=物品名称，日期=今天，备注=物品规格）
    - 账单分类使用物品的 category_id（优先使用传入的值）

    移出已购时：
    - 如果 delete_expense=True，同步删除关联的记账记录
    - 如果 delete_expense=False 或未提供，仅移除已购标记（账单保留）"""
    sid = await _ensure_project(project_id, user, db)

    result = await db.execute(select(PurchasedItem).where(PurchasedItem.project_id == sid, PurchasedItem.item_id == item_id))
    all_existing = result.scalars().all()

    if all_existing:
        # ── 移出已购清单 ──
        # 可能存在历史重复记录，取第一条作为参考，删除全部重复行
        existing = all_existing[0]
        expense_id = existing.expense_id
        if data.delete_expense and expense_id:
            # 同步删除关联的记账记录
            exp_result = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.project_id == sid))
            expense = exp_result.scalar_one_or_none()
            if expense:
                if expense.status in ("paid", "prepaid"):
                    cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.id == f"{sid}_{expense.category_id}"))
                    cat = cat_result.scalar_one_or_none()
                    if cat:
                        cat.spent = max(0, cat.spent - expense.amount)
                await db.delete(expense)
        elif expense_id:
            # ── 移回待购：账单状态改为未支付，保留账单 ──
            exp_result = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.project_id == sid))
            expense = exp_result.scalar_one_or_none()
            if expense:
                # 从已支付改为未支付，调整预算（减少已花费）
                if expense.status in ("paid", "prepaid"):
                    cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.id == f"{sid}_{expense.category_id}"))
                    cat = cat_result.scalar_one_or_none()
                    if cat:
                        cat.spent = max(0, cat.spent - expense.amount)
                expense.status = "unpaid"
            # 重建 SelectedPurchase.expense_id 关联（移回待购后通过此字段识别已有价格）
            sel_result = await db.execute(
                select(SelectedPurchase).where(SelectedPurchase.project_id == sid, SelectedPurchase.item_id == item_id)
            )
            sel_all = sel_result.scalars().all()
            sel = sel_all[0] if sel_all else None
            # 清理多余重复记录
            for extra in sel_all[1:]:
                await db.delete(extra)
            if sel:
                sel.expense_id = expense_id
            elif expense:
                # 待购记录不存在（可能被手动删除），重新创建
                db.add(SelectedPurchase(
                    id=f"sp_{uuid.uuid4().hex[:12]}",
                    project_id=sid,
                    item_id=item_id,
                    expense_id=expense_id,
                ))

        for rec in all_existing:
            await db.delete(rec)
        await db.commit()
        return TogglePurchasedResponse(purchased=False)

    else:
        # ── PurchasedItem 不存在 ──
        # 如果没有提供 price（即调用方意图是"取消已购"而非"添加已购"），
        # 说明 PurchasedItem 已经被删除过了，直接返回 purchased=False
        if data.price is None and data.category_id is None:
            return TogglePurchasedResponse(purchased=False)

        # ── 添加至已购清单 ──
        # 获取物品信息
        item_result = await db.execute(select(PurchaseRefItem).where(PurchaseRefItem.id == item_id))
        item = item_result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="物品不存在")

        # 如果传入了 price，保存到物品
        if data.price is not None:
            item.price = data.price

        # 如果传入了 category_id，保存到物品
        if data.category_id is not None:
            item.category_id = data.category_id

        # 确定账单分类：优先使用传入的，其次使用物品已有的
        expense_category_id = data.category_id or item.category_id or "hard"

        # 检查是否已有待购时自动创建的未支付账单
        sel_result = await db.execute(
            select(SelectedPurchase).where(SelectedPurchase.project_id == sid, SelectedPurchase.item_id == item_id)
        )
        sel_all = sel_result.scalars().all()
        sel = sel_all[0] if sel_all else None
        # 清理多余重复记录
        for extra in sel_all[1:]:
            await db.delete(extra)
        existing_expense_id = sel.expense_id if sel else None

        if existing_expense_id:
            # ── 已有待购账单：更新状态为已支付 ──
            exp_result = await db.execute(
                select(Expense).where(Expense.id == existing_expense_id, Expense.project_id == sid)
            )
            existing_expense = exp_result.scalar_one_or_none()
            if existing_expense:
                # 更新账单状态为已支付，同步更新金额和分类（如果用户提供了新值）
                old_status = existing_expense.status
                old_amount = existing_expense.amount
                old_category_id = existing_expense.category_id

                existing_expense.status = "paid"
                if data.price is not None:
                    existing_expense.amount = data.price
                if data.category_id is not None:
                    existing_expense.category_id = expense_category_id
                existing_expense.sub_category_id = item.sub_category_id

                # 重新构建备注
                note_parts = []
                if item.spec:
                    note_parts.append(item.spec)
                if item.qty and item.unit:
                    note_parts.append(f"{item.qty}{item.unit}")
                elif item.qty:
                    note_parts.append(str(item.qty))
                existing_expense.note = "，".join(note_parts) if note_parts else ""

                # 更新预算已花费：旧状态不是 paid/prepaid 时加上新金额
                new_amount = data.price if data.price is not None else old_amount
                new_category_id = data.category_id if data.category_id is not None else old_category_id

                if old_status not in ("paid", "prepaid"):
                    # 之前未计入预算，现在计入
                    if new_amount > 0:
                        cat_result = await db.execute(
                            select(BudgetCategory).where(BudgetCategory.id == f"{sid}_{new_category_id}")
                        )
                        cat = cat_result.scalar_one_or_none()
                        if cat:
                            cat.spent += new_amount
                else:
                    # 之前已计入预算，可能需要调整
                    if old_category_id != new_category_id or old_amount != new_amount:
                        # 先减去旧的
                        old_cat_result = await db.execute(
                            select(BudgetCategory).where(BudgetCategory.id == f"{sid}_{old_category_id}")
                        )
                        old_cat = old_cat_result.scalar_one_or_none()
                        if old_cat:
                            old_cat.spent = max(0, old_cat.spent - old_amount)
                        # 加上新的
                        if new_amount > 0:
                            new_cat_result = await db.execute(
                                select(BudgetCategory).where(BudgetCategory.id == f"{sid}_{new_category_id}")
                            )
                            new_cat = new_cat_result.scalar_one_or_none()
                            if new_cat:
                                new_cat.spent += new_amount

                expense_id = existing_expense_id
            else:
                # 账单已被删除，创建新账单
                existing_expense_id = None

        if not existing_expense_id:
            # ── 没有待购账单：创建新的已支付账单（原有逻辑）──
            # 构建备注：规格 + 数量
            note_parts = []
            if item.spec:
                note_parts.append(item.spec)
            if item.qty and item.unit:
                note_parts.append(f"{item.qty}{item.unit}")
            elif item.qty:
                note_parts.append(str(item.qty))

            # 创建记账记录
            expense_id = f"exp_{uuid.uuid4().hex[:12]}"
            expense = Expense(
                id=expense_id,
                project_id=sid,
                title=item.name,
                amount=data.price or item.price or 0,
                category_id=expense_category_id,
                sub_category_id=item.sub_category_id,
                stage_id=None,
                date=date.today(),
                status="paid",
                payer=None,
                note="，".join(note_parts) if note_parts else "",
            )
            db.add(expense)

            # 更新预算已花费
            if expense.amount > 0:
                cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.id == f"{sid}_{expense_category_id}"))
                cat = cat_result.scalar_one_or_none()
                if cat:
                    cat.spent += expense.amount

        # 创建已购记录
        pi = PurchasedItem(
            id=f"pi_{uuid.uuid4().hex[:12]}",
            project_id=sid,
            item_id=item_id,
            expense_id=expense_id,
        )
        db.add(pi)
        await db.commit()
        return TogglePurchasedResponse(purchased=True, expense_id=expense_id)


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
    cmp_all = cmp_result.scalars().all()
    existing = cmp_all[0] if cmp_all else None

    if existing:
        for rec in cmp_all:
            await db.delete(rec)
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
        sel_check = sel_result.scalars().all()
        if not sel_check:
            db.add(SelectedPurchase(id=f"sp_{uuid.uuid4().hex[:12]}", project_id=sid, item_id=item_id))
        else:
            # 清理可能的重复
            for extra in sel_check[1:]:
                await db.delete(extra)

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
