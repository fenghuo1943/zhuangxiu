from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Project, Budget, BudgetCategory
from ..schemas import BudgetOut, BudgetUpdate, CategoryAllocationUpdate, BudgetCategoryOut
from ..auth import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}/budget", tags=["Budget"])


async def _verify_owner(project_id: str, user: User, db: AsyncSession) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.get("", response_model=BudgetOut)
async def get_budget(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    result = await db.execute(select(Budget).where(Budget.project_id == project_id))
    budget = result.scalar_one_or_none()
    cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.project_id == project_id))
    categories = cat_result.scalars().all()
    return BudgetOut(
        total=budget.total if budget else 0.0,
        categories=[BudgetCategoryOut.model_validate(c) for c in categories],
    )


@router.put("", response_model=BudgetOut)
async def update_budget(project_id: str, data: BudgetUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    result = await db.execute(select(Budget).where(Budget.project_id == project_id))
    budget = result.scalar_one_or_none()
    if not budget:
        budget = Budget(project_id=project_id, total=data.total)
        db.add(budget)
    else:
        budget.total = data.total
    await db.commit()
    cat_result = await db.execute(select(BudgetCategory).where(BudgetCategory.project_id == project_id))
    return BudgetOut(total=data.total, categories=[BudgetCategoryOut.model_validate(c) for c in cat_result.scalars().all()])


@router.put("/{category_id}", response_model=BudgetCategoryOut)
async def update_category_allocation(project_id: str, category_id: str, data: CategoryAllocationUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    result = await db.execute(select(BudgetCategory).where(BudgetCategory.id == category_id, BudgetCategory.project_id == project_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    cat.allocated = data.allocated
    await db.commit()
    await db.refresh(cat)
    return cat
