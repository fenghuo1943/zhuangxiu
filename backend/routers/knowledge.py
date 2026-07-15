from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models import KnowledgeArticle
from ..schemas import KnowledgeArticleCreate, KnowledgeArticleUpdate, KnowledgeArticleOut
from ..auth import get_current_user

router = APIRouter(prefix="/api/knowledge", tags=["Knowledge"])


@router.get("/{resource_id}", response_model=KnowledgeArticleOut)
async def get_article(resource_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KnowledgeArticle).where(KnowledgeArticle.resource_id == resource_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")
    return article


@router.post("/{resource_id}", response_model=KnowledgeArticleOut, status_code=201)
async def create_article(
    resource_id: int,
    data: KnowledgeArticleCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(KnowledgeArticle).where(KnowledgeArticle.resource_id == resource_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="该资源的文章已存在，请使用 PUT 更新")

    article = KnowledgeArticle(
        resource_id=resource_id,
        title=data.title,
        content=data.content,
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return article


@router.put("/{resource_id}", response_model=KnowledgeArticleOut)
async def update_article(
    resource_id: int,
    data: KnowledgeArticleUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeArticle).where(KnowledgeArticle.resource_id == resource_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(article, key, value)

    await db.commit()
    await db.refresh(article)
    return article
