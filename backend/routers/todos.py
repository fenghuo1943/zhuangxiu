from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Project, Todo
from ..schemas import TodoCreate, TodoUpdate, TodoOut
from ..auth import get_current_user
import uuid

router = APIRouter(prefix="/api/projects/{project_id}/todos", tags=["Todos"])


async def _verify_owner(project_id: str, user: User, db: AsyncSession) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.get("", response_model=list[TodoOut])
async def list_todos(project_id: str, completed: bool = Query(None), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    q = select(Todo).where(Todo.project_id == project_id)
    if completed is not None:
        q = q.where(Todo.completed == completed)
    q = q.order_by(Todo.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=TodoOut, status_code=201)
async def create_todo(project_id: str, data: TodoCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    todo = Todo(id=f"todo_{uuid.uuid4().hex[:12]}", project_id=project_id, title=data.title, stage_id=data.stage_id, due_date=data.due_date)
    db.add(todo)
    await db.commit()
    await db.refresh(todo)
    return todo


@router.put("/{todo_id}", response_model=TodoOut)
async def update_todo(project_id: str, todo_id: str, data: TodoUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    result = await db.execute(select(Todo).where(Todo.id == todo_id, Todo.project_id == project_id))
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="待办不存在")
    update = data.model_dump(exclude_unset=True)
    for k, v in update.items():
        setattr(todo, k, v)
    await db.commit()
    await db.refresh(todo)
    return todo


@router.delete("/{todo_id}", status_code=204)
async def delete_todo(project_id: str, todo_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    result = await db.execute(select(Todo).where(Todo.id == todo_id, Todo.project_id == project_id))
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="待办不存在")
    await db.delete(todo)
    await db.commit()
