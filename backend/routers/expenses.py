import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Project, Expense, BudgetCategory
from ..schemas import ExpenseCreate, ExpenseUpdate, ExpenseOut
from ..auth import get_current_user
import uuid
from datetime import date

router = APIRouter(prefix="/api/projects/{project_id}/expenses", tags=["Expenses"])

STATUS_LABELS = {"paid": "已支付", "prepaid": "预付款", "unpaid": "未支付", "refunded": "已退款"}
CATEGORY_NAMES = {"hard": "硬装工程", "material": "主材选购", "equipment": "设备系统", "soft": "软装家电", "service": "服务杂项"}
NAME_TO_CAT = {v: k for k, v in CATEGORY_NAMES.items()}
LABEL_TO_STATUS = {v: k for k, v in STATUS_LABELS.items()}


def _scoped_id(raw_project_id: str, user_id: str) -> str:
    """Scope a frontend project ID to the current user for data isolation."""
    scope = user_id.replace("-", "")[:8]
    return f"{raw_project_id}_{scope}"


async def _ensure_project(raw_project_id: str, user: User, db: AsyncSession) -> str:
    """Ensure a project exists for this user. Returns the scoped project ID.
    All subsequent DB queries MUST use this scoped ID, not the raw URL param."""
    sid = _scoped_id(raw_project_id, user.id)

    result = await db.execute(
        select(Project).where(Project.id == sid, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if project:
        return sid

    # Auto-create project for this user
    project = Project(
        id=sid,
        user_id=user.id,
        name="默认项目",
        owner_name=user.username or "我",
    )
    db.add(project)
    await db.commit()
    return sid


async def _recalc_category_spent(project_id: str, db: AsyncSession):
    """Recalculate spent for all categories based on paid/prepaid expenses."""
    result = await db.execute(select(Expense).where(Expense.project_id == project_id, Expense.status.in_(["paid", "prepaid"])))
    expenses = result.scalars().all()
    totals: dict[str, float] = {}
    for e in expenses:
        totals[e.category_id] = totals.get(e.category_id, 0) + e.amount
    cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.project_id == project_id))
    for cat in cat_result.scalars():
        cat.spent = totals.get(cat.id, 0.0)


@router.get("", response_model=list[ExpenseOut])
async def list_expenses(
    project_id: str,
    status: str = Query(None),
    q: str = Query(None),
    stage: str = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = await _ensure_project(project_id, user, db)
    query = select(Expense).where(Expense.project_id == sid)
    if status:
        query = query.where(Expense.status == status)
    if stage:
        query = query.where(Expense.stage_id == stage)
    query = query.order_by(Expense.created_at.desc())
    result = await db.execute(query)
    expenses = result.scalars().all()
    if q:
        ql = q.lower()
        expenses = [e for e in expenses if ql in e.title.lower() or (e.note and ql in e.note.lower())]
    return expenses


@router.post("", response_model=ExpenseOut, status_code=201)
async def create_expense(project_id: str, data: ExpenseCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    expense = Expense(
        id=f"exp_{uuid.uuid4().hex[:12]}",
        project_id=sid,
        title=data.title,
        amount=data.amount,
        category_id=data.category_id,
        sub_category_id=data.sub_category_id,
        stage_id=data.stage_id,
        date=data.date,
        status=data.status,
        payer=data.payer,
        note=data.note,
    )
    db.add(expense)
    if data.status in ("paid", "prepaid"):
        result = await db.execute(select(BudgetCategory).where(BudgetCategory.id == f"{sid}_{data.category_id}"))
        cat = result.scalar_one_or_none()
        if cat:
            cat.spent += data.amount
    await db.commit()
    await db.refresh(expense)
    return expense


@router.put("/{expense_id}", response_model=ExpenseOut)
async def update_expense(project_id: str, expense_id: str, data: ExpenseUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.project_id == sid))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="记录不存在")
    old_cat, old_amount, old_status = expense.category_id, expense.amount, expense.status
    update = data.model_dump(exclude_unset=True)
    for k, v in update.items():
        setattr(expense, k, v)

    # Recalculate category spent
    if "amount" in update or "category_id" in update or "status" in update:
        # Need full recalc for safety
        await db.flush()
        await _recalc_category_spent(sid, db)

    await db.commit()
    await db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(project_id: str, expense_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.project_id == sid))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="记录不存在")
    if expense.status in ("paid", "prepaid"):
        cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.id == f"{sid}_{expense.category_id}"))
        cat = cat_result.scalar_one_or_none()
        if cat:
            cat.spent = max(0, cat.spent - expense.amount)
    await db.delete(expense)
    await db.commit()


@router.get("/export-csv")
async def export_csv(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(Expense).where(Expense.project_id == sid).order_by(Expense.created_at.desc()))
    expenses = result.scalars().all()
    output = io.StringIO()
    output.write("﻿标题,金额,分类,日期,状态,备注\n")  # BOM
    for e in expenses:
        cat_name = CATEGORY_NAMES.get(e.category_id, e.category_id)
        status_label = STATUS_LABELS.get(e.status, e.status)
        title = e.title.replace('"', '""')
        note = (e.note or "").replace('"', '""')
        output.write(f'"{title}",{e.amount},"{cat_name}","{e.date}","{status_label}","{note}"\n')
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=expenses_{sid}.csv"})


@router.post("/import-csv")
async def import_csv(project_id: str, file: UploadFile = File(...), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV 文件为空")

    imported, errors = 0, []
    for i, row in enumerate(rows):
        if i == 0:  # skip header
            continue
        if len(row) < 2:
            errors.append({"line": i + 1, "reason": "列数不足"})
            continue
        title = row[0].strip() if len(row) > 0 else ""
        amount_str = row[1].strip() if len(row) > 1 else "0"
        cat_str = row[2].strip() if len(row) > 2 else ""
        date_str = row[3].strip() if len(row) > 3 else ""
        status_str = row[4].strip() if len(row) > 4 else ""

        if not title:
            errors.append({"line": i + 1, "reason": "标题为空"})
            continue
        try:
            amount = float(amount_str)
        except ValueError:
            errors.append({"line": i + 1, "reason": f"金额无效: {amount_str}"})
            continue
        if amount <= 0:
            errors.append({"line": i + 1, "reason": "金额必须大于0"})
            continue

        cat_id = NAME_TO_CAT.get(cat_str, "hard")
        try:
            dt = date.fromisoformat(date_str)
        except ValueError:
            dt = date.today()
        status_val = LABEL_TO_STATUS.get(status_str, "paid")

        expense = Expense(id=f"exp_{uuid.uuid4().hex[:12]}", project_id=sid, title=title, amount=amount,
            category_id=cat_id, date=dt, status=status_val)
        db.add(expense)
        imported += 1

    await _recalc_category_spent(sid, db)
    await db.commit()
    return {"imported": imported, "errors": errors}
