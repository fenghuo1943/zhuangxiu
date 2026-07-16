import csv, io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Project, PriceCategory, PriceModel, ChannelQuote, SyncedModel, SelectedPurchase, PurchaseRefItem, PurchasedItem
from ..schemas import PriceCategoryCreate, PriceCategoryOut, PriceModelCreate, PriceModelOut, ChannelQuoteCreate, ChannelQuoteOut
from ..auth import get_current_user
import uuid
from datetime import datetime, timezone

router = APIRouter(prefix="/api/projects/{project_id}/compare", tags=["Compare"])


async def _verify_owner(project_id: str, user: User, db: AsyncSession) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.get("", response_model=list[PriceCategoryOut])
async def list_categories(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    result = await db.execute(select(PriceCategory).where(PriceCategory.project_id == project_id))
    categories = result.scalars().all()
    out = []
    for cat in categories:
        models_result = await db.execute(select(PriceModel).where(PriceModel.category_id == cat.id))
        models = []
        for m in models_result.scalars().all():
            quotes_result = await db.execute(select(ChannelQuote).where(ChannelQuote.model_id == m.id))
            quotes = [ChannelQuoteOut.model_validate(q) for q in quotes_result.scalars().all()]
            models.append(PriceModelOut(id=m.id, name=m.name, spec=m.spec, note=m.note, quantity=m.quantity, quotes=quotes))
        out.append(PriceCategoryOut(id=cat.id, name=cat.name, icon=cat.icon, models=models))
    return out


@router.post("/categories", response_model=PriceCategoryOut, status_code=201)
async def create_category(project_id: str, data: PriceCategoryCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    cat = PriceCategory(id=f"pc_{uuid.uuid4().hex[:12]}", project_id=project_id, name=data.name, icon=data.icon)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return PriceCategoryOut(id=cat.id, name=cat.name, icon=cat.icon, models=[])


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(project_id: str, category_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    result = await db.execute(select(PriceCategory).where(PriceCategory.id == category_id, PriceCategory.project_id == project_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="品类不存在")
    await db.delete(cat)
    await db.commit()


@router.post("/categories/{category_id}/models", response_model=PriceModelOut, status_code=201)
async def create_model(project_id: str, category_id: str, data: PriceModelCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    model = PriceModel(id=f"pm_{uuid.uuid4().hex[:12]}", category_id=category_id, name=data.name, spec=data.spec, note=data.note, quantity=data.quantity)
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return PriceModelOut(id=model.id, name=model.name, spec=model.spec, note=model.note, quantity=model.quantity, quotes=[])


@router.delete("/models/{model_id}", status_code=204)
async def delete_model(project_id: str, model_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    result = await db.execute(select(PriceModel).where(PriceModel.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="型号不存在")
    await db.delete(model)
    await db.commit()


@router.post("/models/{model_id}/quotes", response_model=ChannelQuoteOut, status_code=201)
async def create_quote(project_id: str, model_id: str, data: ChannelQuoteCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    quote = ChannelQuote(id=f"ch_{uuid.uuid4().hex[:12]}", model_id=model_id, channel=data.channel, price=data.price, url=data.url, updated_at=datetime.now(timezone.utc))
    db.add(quote)
    await db.commit()
    await db.refresh(quote)
    return quote


@router.delete("/quotes/{quote_id}", status_code=204)
async def delete_quote(project_id: str, quote_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    result = await db.execute(select(ChannelQuote).where(ChannelQuote.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="报价不存在")
    await db.delete(quote)
    await db.commit()


@router.put("/models/{model_id}/sync")
async def toggle_model_sync(project_id: str, model_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    result = await db.execute(select(SyncedModel).where(SyncedModel.project_id == project_id, SyncedModel.model_id == model_id))
    existing = result.scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()
        return {"synced": False, "auto_purchased": 0}
    else:
        sm = SyncedModel(id=f"sm_{uuid.uuid4().hex[:12]}", project_id=project_id, model_id=model_id)
        db.add(sm)

        # Reverse sync: auto-purchase matching selected purchase items
        auto_purchased = 0
        model_result = await db.execute(select(PriceModel).where(PriceModel.id == model_id))
        model = model_result.scalar_one_or_none()
        if model:
            sel_result = await db.execute(select(SelectedPurchase).where(SelectedPurchase.project_id == project_id))
            selected_ids = [s.item_id for s in sel_result.scalars().all()]
            if selected_ids:
                from sqlalchemy import func
                items_result = await db.execute(
                    select(PurchaseRefItem).where(
                        PurchaseRefItem.id.in_(selected_ids),
                        func.lower(PurchaseRefItem.name) == model.name.lower()
                    )
                )
                for item in items_result.scalars().all():
                    existing_purch = await db.execute(
                        select(PurchasedItem).where(PurchasedItem.project_id == project_id, PurchasedItem.item_id == item.id)
                    )
                    if not existing_purch.scalar_one_or_none():
                        db.add(PurchasedItem(id=f"pi_{uuid.uuid4().hex[:12]}", project_id=project_id, item_id=item.id))
                        auto_purchased += 1

        await db.commit()
        return {"synced": True, "auto_purchased": auto_purchased}


@router.get("/export-csv")
async def export_csv(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    result = await db.execute(select(PriceCategory).where(PriceCategory.project_id == project_id))
    categories = result.scalars().all()
    output = io.StringIO()
    output.write("﻿品类,型号,规格,备注,数量,渠道,价格\n")
    for cat in categories:
        models_result = await db.execute(select(PriceModel).where(PriceModel.category_id == cat.id))
        for m in models_result.scalars().all():
            quotes_result = await db.execute(select(ChannelQuote).where(ChannelQuote.model_id == m.id))
            quotes = quotes_result.scalars().all()
            if not quotes:
                output.write(f'"{cat.name}","{m.name}","{m.spec or ""}","{m.note or ""}",{m.quantity},,--\n')
            for q in quotes:
                output.write(f'"{cat.name}","{m.name}","{m.spec or ""}","{m.note or ""}",{m.quantity},"{q.channel}",{q.price or ""}\n')
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=compare_{project_id}.csv"})


@router.post("/import-csv")
async def import_csv(project_id: str, file: UploadFile = File(...), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _verify_owner(project_id, user, db)
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    imported = 0
    cat_cache: dict[str, str] = {}
    for i, row in enumerate(rows):
        if i == 0: continue
        if len(row) < 5: continue
        cat_name, model_name, spec, note, qty_str = row[0], row[1], row[2], row[3], row[4]
        if not cat_name or not model_name: continue
        qty = int(qty_str) if qty_str.isdigit() else 1

        if cat_name not in cat_cache:
            cat = PriceCategory(id=f"pc_{uuid.uuid4().hex[:12]}", project_id=project_id, name=cat_name)
            db.add(cat)
            cat_cache[cat_name] = cat.id
            await db.flush()

        model = PriceModel(id=f"pm_{uuid.uuid4().hex[:12]}", category_id=cat_cache[cat_name], name=model_name, spec=spec or None, note=note or None, quantity=qty)
        db.add(model)
        imported += 1
    await db.commit()
    return {"imported": imported}
