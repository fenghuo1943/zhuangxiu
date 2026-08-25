from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from ..database import get_db
from ..models import User, Project, ExpenseSubCategory, Expense, PurchaseRefItem
from ..schemas import SubCategoryCreate, SubCategoryUpdate, SubCategoryOut
from ..auth import get_current_user
import uuid

router = APIRouter(prefix="/api/projects/{project_id}/subcategories", tags=["SubCategories"])


def _scoped_id(raw_project_id: str, user_id: str) -> str:
    """Scope a frontend project ID to the current user for data isolation."""
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


def _frontend_sub_id(db_sub: ExpenseSubCategory, sid: str) -> SubCategoryOut:
    """Convert a DB subcategory to frontend-friendly output."""
    out = SubCategoryOut.model_validate(db_sub)
    # 默认分类的ID保持不变（如 shuidian）
    # 项目专属分类的ID需要加上项目前缀
    if db_sub.project_id and db_sub.project_id == sid:
        # 项目专属分类，ID格式：sub_{timestamp}，前端直接使用
        pass
    return out


@router.get("", response_model=list[SubCategoryOut])
async def list_subcategories(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取子分类列表：默认分类 + 当前项目专属分类"""
    sid = await _ensure_project(project_id, user, db)

    # 查询默认分类（project_id IS NULL）
    default_result = await db.execute(
        select(ExpenseSubCategory).where(ExpenseSubCategory.project_id.is_(None))
    )
    default_subs = default_result.scalars().all()

    # 查询当前项目专属分类
    project_result = await db.execute(
        select(ExpenseSubCategory).where(ExpenseSubCategory.project_id == sid)
    )
    project_subs = project_result.scalars().all()

    # 合并返回，转换为前端格式
    all_subs = default_subs + project_subs
    return [_frontend_sub_id(s, sid) for s in all_subs]


@router.post("", response_model=SubCategoryOut, status_code=201)
async def create_subcategory(
    project_id: str,
    data: SubCategoryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """新增子分类（仅当前项目可见）"""
    sid = await _ensure_project(project_id, user, db)

    # 检查是否已存在同名子分类（在同一个大分类下）
    existing = await db.execute(
        select(ExpenseSubCategory).where(
            and_(
                ExpenseSubCategory.name == data.name,
                ExpenseSubCategory.category_id == data.category_id,
                # 检查默认分类和当前项目分类
                (ExpenseSubCategory.project_id.is_(None) | (ExpenseSubCategory.project_id == sid))
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该分类下已存在同名子分类")

    sub = ExpenseSubCategory(
        id=f"sub_{uuid.uuid4().hex[:12]}",
        project_id=sid,
        name=data.name.strip(),
        category_id=data.category_id,
        is_default=False,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return _frontend_sub_id(sub, sid)


@router.put("/{sub_id}", response_model=SubCategoryOut)
async def update_subcategory(
    project_id: str,
    sub_id: str,
    data: SubCategoryUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新子分类（重命名/移动）"""
    sid = await _ensure_project(project_id, user, db)

    # 查找子分类（默认分类或当前项目专属分类）
    result = await db.execute(
        select(ExpenseSubCategory).where(
            and_(
                ExpenseSubCategory.id == sub_id,
                (ExpenseSubCategory.project_id.is_(None) | (ExpenseSubCategory.project_id == sid))
            )
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="子分类不存在")

    # 更新名称
    if data.name is not None:
        sub.name = data.name.strip()

    # 移动到其他大分类
    if data.category_id is not None:
        sub.category_id = data.category_id

    await db.commit()
    await db.refresh(sub)
    return _frontend_sub_id(sub, sid)


@router.delete("/{sub_id}")
async def delete_subcategory(
    project_id: str,
    sub_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除子分类（需检查引用，不允许删除默认分类）"""
    sid = await _ensure_project(project_id, user, db)

    # 查找子分类
    result = await db.execute(
        select(ExpenseSubCategory).where(
            and_(
                ExpenseSubCategory.id == sub_id,
                (ExpenseSubCategory.project_id.is_(None) | (ExpenseSubCategory.project_id == sid))
            )
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="子分类不存在")

    # 不允许删除默认分类
    if sub.is_default:
        raise HTTPException(status_code=400, detail="默认分类不允许删除")

    # 检查是否有账单引用该子分类
    expense_result = await db.execute(
        select(Expense).where(
            and_(
                Expense.project_id == sid,
                Expense.sub_category_id == sub_id
            )
        )
    )
    if expense_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该分类下有账单记录，无法删除")

    # 检查是否有采购物品引用该子分类
    item_result = await db.execute(
        select(PurchaseRefItem).where(
            and_(
                PurchaseRefItem.project_id == sid,
                PurchaseRefItem.sub_category_id == sub_id
            )
        )
    )
    if item_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该分类下有采购物品，无法删除")

    # 删除子分类
    await db.delete(sub)
    await db.commit()
    return {"status": "ok", "deleted": sub_id}
