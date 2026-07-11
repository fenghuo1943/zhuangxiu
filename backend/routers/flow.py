from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Project, FlowProgress
from ..schemas import FlowProgressUpdate, FlowProgressOut
from ..auth import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}/flow", tags=["Flow"])


@router.get("", response_model=FlowProgressOut)
async def get_flow(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")
    fp_result = await db.execute(select(FlowProgress).where(FlowProgress.project_id == project_id))
    fp = fp_result.scalar_one_or_none()
    if not fp:
        fp = FlowProgress(project_id=project_id)
        db.add(fp)
        await db.commit()
        await db.refresh(fp)
    return fp


@router.put("", response_model=FlowProgressOut)
async def update_flow(project_id: str, data: FlowProgressUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")
    fp_result = await db.execute(select(FlowProgress).where(FlowProgress.project_id == project_id))
    fp = fp_result.scalar_one_or_none()
    if not fp:
        fp = FlowProgress(project_id=project_id)
        db.add(fp)
    update = data.model_dump(exclude_unset=True)
    for k, v in update.items():
        setattr(fp, k, v)
    await db.commit()
    await db.refresh(fp)
    return fp
