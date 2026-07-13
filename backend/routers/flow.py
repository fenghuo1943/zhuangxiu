import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Project, FlowProgress, StageNote, CustomFlowStep
from ..schemas import (
    FlowProgressUpdate, FlowProgressOut,
    StageNoteCreate, StageNoteUpdate, StageNoteOut,
    CustomFlowStepCreate, CustomFlowStepUpdate, CustomFlowStepOut,
)
from ..auth import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}/flow", tags=["Flow"])


# ---------- helpers ----------

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

    # Auto-create
    is_guest = user.id.startswith("g_")
    project = Project(
        id=sid,
        user_id=user.id,
        name="默认项目",
        owner_name=user.username if is_guest else (user.username or "我"),
    )
    db.add(project)
    await db.commit()
    return sid


# ==================== Flow Progress ====================

@router.get("", response_model=FlowProgressOut)
async def get_flow(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = await _ensure_project(project_id, user, db)
    fp_result = await db.execute(select(FlowProgress).where(FlowProgress.project_id == sid))
    fp = fp_result.scalar_one_or_none()
    if not fp:
        fp = FlowProgress(project_id=sid)
        db.add(fp)
        await db.commit()
        await db.refresh(fp)
    return fp


@router.put("", response_model=FlowProgressOut)
async def update_flow(
    project_id: str,
    data: FlowProgressUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = await _ensure_project(project_id, user, db)
    fp_result = await db.execute(select(FlowProgress).where(FlowProgress.project_id == sid))
    fp = fp_result.scalar_one_or_none()
    if not fp:
        fp = FlowProgress(project_id=sid)
        db.add(fp)
    update = data.model_dump(exclude_unset=True)
    for k, v in update.items():
        setattr(fp, k, v)
    await db.commit()
    await db.refresh(fp)
    return fp


@router.put("/steps/{step_id}/done")
async def mark_step_done(
    project_id: str,
    step_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = await _ensure_project(project_id, user, db)
    fp_result = await db.execute(select(FlowProgress).where(FlowProgress.project_id == sid))
    fp = fp_result.scalar_one_or_none()
    if not fp:
        fp = FlowProgress(project_id=sid)
        db.add(fp)

    done_ids = list(fp.done_step_ids or [])
    if step_id in done_ids:
        done_ids.remove(step_id)
    else:
        done_ids.append(step_id)
    fp.done_step_ids = done_ids
    await db.commit()
    return {"done_step_ids": done_ids}


# ==================== Stage Notes ====================

@router.get("/stages/{stage_id}/notes", response_model=list[StageNoteOut])
async def list_stage_notes(
    project_id: str,
    stage_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = await _ensure_project(project_id, user, db)
    notes_result = await db.execute(
        select(StageNote).where(
            StageNote.project_id == sid,
            StageNote.stage_id == stage_id,
        ).order_by(StageNote.created_at.desc())
    )
    return notes_result.scalars().all()


@router.post("/stages/{stage_id}/notes", response_model=StageNoteOut, status_code=201)
async def create_stage_note(
    project_id: str,
    stage_id: str,
    data: StageNoteCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = await _ensure_project(project_id, user, db)
    note = StageNote(
        id=f"sn_{uuid.uuid4().hex[:12]}",
        project_id=sid,
        stage_id=stage_id,
        content=data.content,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.put("/stages/{stage_id}/notes/{note_id}", response_model=StageNoteOut)
async def update_stage_note(
    project_id: str,
    stage_id: str,
    note_id: str,
    data: StageNoteUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(StageNote).where(
        StageNote.id == note_id,
        StageNote.project_id == sid,
        StageNote.stage_id == stage_id,
    ))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="备注不存在")
    note.content = data.content
    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/stages/{stage_id}/notes/{note_id}")
async def delete_stage_note(
    project_id: str,
    stage_id: str,
    note_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(StageNote).where(
        StageNote.id == note_id,
        StageNote.project_id == sid,
        StageNote.stage_id == stage_id,
    ))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="备注不存在")
    await db.delete(note)
    await db.commit()
    return {"status": "ok"}


# ==================== Custom Flow Steps ====================

@router.get("/custom-steps", response_model=list[CustomFlowStepOut])
async def list_custom_steps(
    project_id: str,
    flow_type: str = "new",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = await _ensure_project(project_id, user, db)
    steps_result = await db.execute(
        select(CustomFlowStep).where(
            CustomFlowStep.project_id == sid,
            CustomFlowStep.flow_type == flow_type,
        ).order_by(CustomFlowStep.sort_order)
    )
    return steps_result.scalars().all()


@router.post("/custom-steps", response_model=CustomFlowStepOut, status_code=201)
async def create_custom_step(
    project_id: str,
    data: CustomFlowStepCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = await _ensure_project(project_id, user, db)
    step = CustomFlowStep(
        id=f"cs_{uuid.uuid4().hex[:12]}",
        project_id=sid,
        flow_type=data.flow_type,
        title=data.title,
        days=data.days,
        desc=data.desc,
        sort_order=data.sort_order,
    )
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return step


@router.put("/custom-steps/{step_id}", response_model=CustomFlowStepOut)
async def update_custom_step(
    project_id: str,
    step_id: str,
    data: CustomFlowStepUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(CustomFlowStep).where(
        CustomFlowStep.id == step_id,
        CustomFlowStep.project_id == sid,
    ))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="自定义阶段不存在")
    update = data.model_dump(exclude_unset=True)
    for k, v in update.items():
        setattr(step, k, v)
    await db.commit()
    await db.refresh(step)
    return step


@router.delete("/custom-steps/{step_id}")
async def delete_custom_step(
    project_id: str,
    step_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sid = await _ensure_project(project_id, user, db)
    result = await db.execute(select(CustomFlowStep).where(
        CustomFlowStep.id == step_id,
        CustomFlowStep.project_id == sid,
    ))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="自定义阶段不存在")
    await db.delete(step)
    await db.commit()
    return {"status": "ok"}
