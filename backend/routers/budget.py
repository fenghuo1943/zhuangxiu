from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from ..database import get_db
from ..models import User, Project, Budget, BudgetCategory
from ..schemas import BudgetOut, BudgetUpdate, CategoryAllocationUpdate, BudgetCategoryOut
from ..auth import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}/budget", tags=["Budget"])


def _category_key(raw_category_id: str, sid: str | None = None) -> str:
    """Return a canonical frontend category key from a scoped or legacy ID."""
    category_id = (raw_category_id or "").strip()
    if sid and category_id.startswith(f"{sid}_"):
        category_id = category_id[len(sid) + 1:]
    return category_id.rsplit("_", 1)[-1]


def _scoped_id(raw_project_id: str, user_id: str) -> str:
    """Scope a frontend project ID to the current user for data isolation.

    Idempotent: returns unchanged if already scoped for this user.
    """
    scope = user_id.replace("-", "")[:8]
    suffix = f"_{scope}"
    if raw_project_id.endswith(suffix):
        return raw_project_id
    return f"{raw_project_id}_{scope}"


async def _ensure_project(raw_project_id: str, user: User, db: AsyncSession) -> str:
    """Ensure a project exists for this user. Returns the scoped project ID."""
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


def _frontend_cat_id(db_cat: BudgetCategory, sid: str):
    """Convert a DB category (id = 'p1_<hash>_hard' or '<hash>_hard') to a frontend-friendly version (id = 'hard')."""
    cat = BudgetCategoryOut.model_validate(db_cat)
    prefix = sid + "_"
    if cat.id.startswith(prefix):
        # 标准格式：p1_<hash>_hard → hard
        cat.id = cat.id[len(prefix):]
    elif "_" in cat.id:
        # 回退格式：<hash>_hard → hard（数据库中可能存储了不带项目前缀的ID）
        cat.id = cat.id.rsplit("_", 1)[-1]
    cat.id = _category_key(cat.id, sid)
    return cat


@router.get("", response_model=BudgetOut)
async def get_budget(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(Budget).where(Budget.project_id == sid))
    budget = result.scalar_one_or_none()
    cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.project_id == sid))
    categories = cat_result.scalars().all()
    # Clean up stale duplicate categories: keep only the correctly scoped row per frontend key
    prefix = sid + "_"
    seen_frontend_keys: dict[str, BudgetCategory] = {}
    stale_ids: list[str] = []
    for c in categories:
        frontend_key = _category_key(c.id, sid)
        if frontend_key in seen_frontend_keys:
            # Duplicate — keep the correctly scoped one (starts with sid_), mark the other stale
            existing = seen_frontend_keys[frontend_key]
            canonical_id = f"{sid}_{frontend_key}"
            if c.id == canonical_id and existing.id != canonical_id:
                stale_ids.append(existing.id)
                seen_frontend_keys[frontend_key] = c
            else:
                stale_ids.append(c.id)
        else:
            seen_frontend_keys[frontend_key] = c
    repaired_ids = False
    for frontend_key, cat in seen_frontend_keys.items():
        canonical_id = f"{sid}_{frontend_key}"
        if cat.id != canonical_id:
            cat.id = canonical_id
            repaired_ids = True
    if stale_ids or repaired_ids:
        for stale_id in stale_ids:
            await db.execute(delete(BudgetCategory).where(BudgetCategory.id == stale_id, BudgetCategory.project_id == sid))
        await db.commit()
        categories = list(seen_frontend_keys.values())
    return BudgetOut(
        total=budget.total if budget else 0.0,
        categories=[_frontend_cat_id(c, sid) for c in categories],
    )


@router.put("", response_model=BudgetOut)
async def update_budget(project_id: str, data: BudgetUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(Budget).where(Budget.project_id == sid))
    budget = result.scalar_one_or_none()
    if not budget:
        budget = Budget(project_id=sid, total=data.total)
        db.add(budget)
    else:
        budget.total = data.total
    await db.flush()

    # Sync category allocations if provided
    if data.categories:
        for cat_data in data.categories:
            # Build scoped category ID: sid_frontendKey
            cat_key = _category_key(cat_data.id, sid)
            db_cat_id = f"{sid}_{cat_key}"
            cat_result = await db.execute(
                select(BudgetCategory).where(BudgetCategory.id == db_cat_id, BudgetCategory.project_id == sid)
            )
            cat = cat_result.scalar_one_or_none()
            if not cat:
                # Use provided name/color, or fall back to defaults based on category key
                DEFAULT_NAMES = {
                    'hard': '硬装工程',
                    'material': '主材选购',
                    'equipment': '设备系统',
                    'soft': '软装家电',
                    'service': '服务杂项',
                }
                DEFAULT_COLORS = {
                    'hard': '#e45b3f',
                    'material': '#5f9f77',
                    'equipment': '#5c7fa8',
                    'soft': '#be7b2f',
                    'service': '#9b928b',
                }
                cat_name = cat_data.name or DEFAULT_NAMES.get(cat_key, cat_key)
                cat_color = cat_data.color or DEFAULT_COLORS.get(cat_key, "#999")
                cat = BudgetCategory(
                    id=db_cat_id,
                    project_id=sid,
                    name=cat_name,
                    color=cat_color,
                    allocated=0.0,
                    spent=0.0,
                )
                db.add(cat)
            else:
                # Update existing category name/color if provided
                if cat_data.name:
                    cat.name = cat_data.name
                if cat_data.color:
                    cat.color = cat_data.color
            cat.allocated = cat_data.allocated

    await db.commit()
    cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.project_id == sid))
    return BudgetOut(total=data.total, categories=[_frontend_cat_id(c, sid) for c in cat_result.scalars().all()])


@router.put("/{category_id}", response_model=BudgetCategoryOut)
async def update_category_allocation(project_id: str, category_id: str, data: CategoryAllocationUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    # Accept a frontend key as well as legacy/full IDs, but persist only one prefix.
    cat_key = _category_key(category_id, sid)
    db_category_id = f"{sid}_{cat_key}"
    result = await db.execute(select(BudgetCategory).where(BudgetCategory.id == db_category_id, BudgetCategory.project_id == sid))
    cat = result.scalar_one_or_none()
    if not cat:
        # If category doesn't exist yet, auto-create it with proper name and color
        # Use provided name/color, or fall back to defaults based on category key
        DEFAULT_NAMES = {
            'hard': '硬装工程',
            'material': '主材选购',
            'equipment': '设备系统',
            'soft': '软装家电',
            'service': '服务杂项',
        }
        DEFAULT_COLORS = {
            'hard': '#e45b3f',
            'material': '#5f9f77',
            'equipment': '#5c7fa8',
            'soft': '#be7b2f',
            'service': '#9b928b',
        }
        frontend_key = db_category_id.rsplit("_", 1)[-1] if "_" in db_category_id else db_category_id
        cat_name = data.name or DEFAULT_NAMES.get(frontend_key, frontend_key)
        cat_color = data.color or DEFAULT_COLORS.get(frontend_key, "#999")
        cat = BudgetCategory(id=db_category_id, project_id=sid, name=cat_name, color=cat_color, allocated=0.0, spent=0.0)
        db.add(cat)
    else:
        # Update existing category name/color if provided
        if data.name:
            cat.name = data.name
        if data.color:
            cat.color = data.color
    cat.allocated = data.allocated
    await db.commit()
    await db.refresh(cat)
    return _frontend_cat_id(cat, sid)


@router.post("/recalc")
async def recalc_budget_spent(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Recalculate budget category spent from actual paid/prepaid expenses."""
    from ..models import Expense

    sid = await _ensure_project(project_id, user, db)

    result = await db.execute(
        select(Expense).where(Expense.project_id == sid, Expense.status.in_(["paid", "prepaid"]))
    )
    expenses = result.scalars().all()
    totals: dict[str, float] = {}
    for e in expenses:
        key = _category_key(e.category_id)
        totals[key] = totals.get(key, 0.0) + e.amount

    cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.project_id == sid))
    for cat in cat_result.scalars():
        cat.spent = totals.get(_category_key(cat.id, sid), 0.0)

    await db.commit()
    return {"status": "ok", "recalculated": len(expenses)}
