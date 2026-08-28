from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pathlib import Path
from ..database import get_db
from ..models import User, Project, RenovationDiary, PurchaseRefStage, Tip
from ..schemas import DiaryCreate, DiaryUpdate, DiaryOut
from ..auth import get_current_user
import uuid

# 图片存储目录
IMAGE_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "assets" / "flow-images"


def _delete_image_files(images: list[str]):
    """删除图片文件列表"""
    for img_url in images:
        # 从URL提取文件名: /assets/flow-images/xxx.jpg -> xxx.jpg
        if "/assets/flow-images/" in img_url:
            filename = img_url.split("/assets/flow-images/")[-1]
            filepath = IMAGE_DIR / filename
            if filepath.exists():
                filepath.unlink()


async def _get_all_used_images(user_id: str, db: AsyncSession) -> set[str]:
    """获取所有被使用的图片URL"""
    used_images = set()

    # 获取用户的所有项目
    result = await db.execute(
        select(Project).where(Project.user_id == user_id)
    )
    projects = result.scalars().all()

    for project in projects:
        # 获取项目下的所有日记图片
        diary_result = await db.execute(
            select(RenovationDiary.images).where(RenovationDiary.project_id == project.id)
        )
        for (images,) in diary_result:
            if images:
                used_images.update(images)

    # 获取用户的所有装修技巧图片
    tip_result = await db.execute(
        select(Tip.images).where(Tip.user_id == user_id)
    )
    for (images,) in tip_result:
        if images:
            used_images.update(images)

    return used_images

router = APIRouter(tags=["Diaries"])


def _scoped_id(raw_project_id: str, user_id: str) -> str:
    """将前端项目 ID 作用域化到当前用户，实现数据隔离。"""
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
        raise HTTPException(status_code=404, detail="项目不存在")
    return sid


async def _validate_stage_parent(stage_parent: str, db: AsyncSession) -> bool:
    """验证阶段父分类是否存在。"""
    result = await db.execute(
        select(PurchaseRefStage).where(PurchaseRefStage.parent == stage_parent)
    )
    return result.scalar_one_or_none() is not None


@router.get("/api/projects/{project_id}/diaries", response_model=list[DiaryOut])
async def get_diaries(
    project_id: str,
    stage_parent: Optional[str] = Query(None, max_length=100),
    q: Optional[str] = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取项目日记列表"""
    sid = await _ensure_project(project_id, user, db)

    query = select(RenovationDiary).where(RenovationDiary.project_id == sid)

    if stage_parent:
        query = query.where(RenovationDiary.stage_parent == stage_parent)

    if q:
        search_term = f"%{q}%"
        query = query.where(
            or_(
                RenovationDiary.title.ilike(search_term),
                RenovationDiary.content.ilike(search_term),
            )
        )

    query = query.order_by(RenovationDiary.date.desc(), RenovationDiary.created_at.desc())
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/api/projects/{project_id}/diaries/count")
async def get_diaries_count(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取项目日记总数（不受筛选条件影响）"""
    from sqlalchemy import func

    sid = await _ensure_project(project_id, user, db)

    result = await db.execute(
        select(func.count(RenovationDiary.id)).where(RenovationDiary.project_id == sid)
    )
    count = result.scalar() or 0
    return {"count": count}


@router.post("/api/projects/{project_id}/diaries", response_model=DiaryOut, status_code=201)
async def create_diary(
    project_id: str,
    data: DiaryCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建日记"""
    sid = await _ensure_project(project_id, user, db)

    # 验证阶段是否存在
    if not await _validate_stage_parent(data.stage_parent, db):
        raise HTTPException(status_code=400, detail="装修阶段不存在")

    # 验证图片数量
    if len(data.images) > 9:
        raise HTTPException(status_code=400, detail="最多上传9张图片")

    diary = RenovationDiary(
        id=f"diary_{uuid.uuid4().hex[:12]}",
        project_id=sid,
        title=data.title,
        date=data.date,
        stage_parent=data.stage_parent,
        content=data.content,
        images=data.images,
    )
    db.add(diary)
    await db.commit()
    await db.refresh(diary)
    return diary


@router.put("/api/projects/{project_id}/diaries/{diary_id}", response_model=DiaryOut)
async def update_diary(
    project_id: str,
    diary_id: str,
    data: DiaryUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新日记"""
    sid = await _ensure_project(project_id, user, db)

    # 查找日记
    result = await db.execute(
        select(RenovationDiary).where(
            RenovationDiary.id == diary_id,
            RenovationDiary.project_id == sid,
        )
    )
    diary = result.scalar_one_or_none()
    if not diary:
        raise HTTPException(status_code=404, detail="日记不存在")

    # 验证阶段
    if data.stage_parent is not None:
        if not await _validate_stage_parent(data.stage_parent, db):
            raise HTTPException(status_code=400, detail="装修阶段不存在")
        diary.stage_parent = data.stage_parent

    # 验证图片数量
    images = data.images if data.images is not None else diary.images
    if len(images) > 9:
        raise HTTPException(status_code=400, detail="最多上传9张图片")

    # 删除被移除的图片文件
    if data.images is not None:
        removed_images = set(diary.images or []) - set(data.images)
        if removed_images:
            _delete_image_files(list(removed_images))

    # 更新字段
    if data.title is not None:
        diary.title = data.title
    if data.date is not None:
        diary.date = data.date
    if data.content is not None:
        diary.content = data.content
    if data.images is not None:
        diary.images = data.images

    await db.commit()
    await db.refresh(diary)
    return diary


@router.delete("/api/projects/{project_id}/diaries/{diary_id}", status_code=204)
async def delete_diary(
    project_id: str,
    diary_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除日记"""
    sid = await _ensure_project(project_id, user, db)

    result = await db.execute(
        select(RenovationDiary).where(
            RenovationDiary.id == diary_id,
            RenovationDiary.project_id == sid,
        )
    )
    diary = result.scalar_one_or_none()
    if not diary:
        raise HTTPException(status_code=404, detail="日记不存在")

    # 删除图片文件
    if diary.images:
        _delete_image_files(diary.images)

    # 删除日记
    await db.delete(diary)
    await db.commit()


@router.post("/api/cleanup-unused-images")
async def cleanup_unused_images(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """清理未使用的图片资源"""
    # 确保图片目录存在
    if not IMAGE_DIR.exists():
        return {"deleted_count": 0, "message": "图片目录不存在"}

    # 获取所有文件中的图片
    all_files = set()
    for file in IMAGE_DIR.iterdir():
        if file.is_file():
            all_files.add(f"/assets/flow-images/{file.name}")

    # 获取所有被使用的图片
    used_images = await _get_all_used_images(user.id, db)

    # 找出未使用的图片
    unused_images = all_files - used_images

    # 删除未使用的图片
    deleted_count = 0
    for img_url in unused_images:
        filename = img_url.split("/assets/flow-images/")[-1]
        filepath = IMAGE_DIR / filename
        if filepath.exists():
            filepath.unlink()
            deleted_count += 1

    return {"deleted_count": deleted_count, "message": f"已清理 {deleted_count} 张未使用的图片"}
