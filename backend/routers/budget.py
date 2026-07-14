from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Project, Budget, BudgetCategory
from ..schemas import BudgetOut, BudgetUpdate, CategoryAllocationUpdate, BudgetCategoryOut
from ..auth import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}/budget", tags=["Budget"])


def _scoped_id(raw_project_id: str, user_id: str) -> str:
    """Scope a frontend project ID to the current user for data isolation."""
    scope = user_id.replace("-", "")[:8]
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
    """Convert a DB category (id = 'p1_<hash>_hard') to a frontend-friendly version (id = 'hard')."""
    cat = BudgetCategoryOut.model_validate(db_cat)
    prefix = sid + "_"
    if cat.id.startswith(prefix):
        cat.id = cat.id[len(prefix):]
    return cat


@router.get("", response_model=BudgetOut)
async def get_budget(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(Budget).where(Budget.project_id == sid))
    budget = result.scalar_one_or_none()
    cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.project_id == sid))
    categories = cat_result.scalars().all()
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
            db_cat_id = f"{sid}_{cat_data.id}"
            cat_result = await db.execute(
                select(BudgetCategory).where(BudgetCategory.id == db_cat_id, BudgetCategory.project_id == sid)
            )
            cat = cat_result.scalar_one_or_none()
            if not cat:
                cat = BudgetCategory(
                    id=db_cat_id,
                    project_id=sid,
                    name=cat_data.name or cat_data.id,
                    color=cat_data.color or "#999",
                    allocated=0.0,
                    spent=0.0,
                )
                db.add(cat)
            cat.allocated = cat_data.allocated

    await db.commit()
    cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.project_id == sid))
    return BudgetOut(total=data.total, categories=[_frontend_cat_id(c, sid) for c in cat_result.scalars().all()])


@router.put("/{category_id}", response_model=BudgetCategoryOut)
async def update_category_allocation(project_id: str, category_id: str, data: CategoryAllocationUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = await _ensure_project(project_id, user, db)
    # Map frontend category ID (e.g. "p1_hard") to scoped DB category ID (e.g. "p1_<hash>_hard")
    if category_id.startswith(project_id + "_"):
        db_category_id = sid + "_" + category_id[len(project_id) + 1:]
    else:
        db_category_id = category_id
    result = await db.execute(select(BudgetCategory).where(BudgetCategory.id == db_category_id, BudgetCategory.project_id == sid))
    cat = result.scalar_one_or_none()
    if not cat:
        # If category doesn't exist yet, auto-create it
        # Extract the frontend category key from the ID
        frontend_key = db_category_id.rsplit("_", 1)[-1] if "_" in db_category_id else db_category_id
        cat = BudgetCategory(id=db_category_id, project_id=sid, name=frontend_key, color="#999", allocated=0.0, spent=0.0)
        db.add(cat)
    cat.allocated = data.allocated
    await db.commit()
    await db.refresh(cat)
    return cat
