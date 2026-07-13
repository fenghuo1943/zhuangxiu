from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Project, Budget, BudgetCategory, FlowProgress
from ..schemas import ProjectCreate, ProjectUpdate, ProjectOut
from ..auth import get_current_user_or_guest
import uuid

router = APIRouter(prefix="/api/projects", tags=["Projects"])

DEFAULT_CATEGORIES = [
    ("hard", "硬装工程", "#e45b3f"),
    ("material", "主材选购", "#5f9f77"),
    ("equipment", "设备系统", "#5c7fa8"),
    ("soft", "软装家电", "#be7b2f"),
    ("service", "服务杂项", "#9b928b"),
]


async def _init_project_data(db: AsyncSession, project: Project):
    """Create default budget, categories, and flow progress for a new project."""
    db.add(Budget(project_id=project.id, total=0.0))
    for cid, cname, ccolor in DEFAULT_CATEGORIES:
        db.add(BudgetCategory(id=f"{project.id}_{cid}", project_id=project.id, name=cname, color=ccolor))
    db.add(FlowProgress(project_id=project.id))


@router.get("", response_model=list[ProjectOut])
async def list_projects(user: User = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.user_id == user.id))
    return result.scalars().all()


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(data: ProjectCreate, user: User = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)):
    project = Project(id=f"proj_{uuid.uuid4().hex[:12]}", user_id=user.id, name=data.name, owner_name=data.owner_name)
    db.add(project)
    await _init_project_data(db, project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, user: User = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: str, data: ProjectUpdate, user: User = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    update = data.model_dump(exclude_unset=True)
    for k, v in update.items():
        setattr(project, k, v)
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, user: User = Depends(get_current_user_or_guest), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    await db.delete(project)
    await db.commit()
