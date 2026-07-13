from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .database import get_db
from .models import User
from .config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_DAYS

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

GUEST_USER_ID = "guest"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hash.encode("utf-8"))


def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub", "")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的认证令牌")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")
    return user


async def _get_or_create_guest(db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == GUEST_USER_ID))
    guest = result.scalar_one_or_none()
    if not guest:
        guest = User(
            id=GUEST_USER_ID,
            username="游客",
            email="guest@xiaozhuangjia.local",
            password_hash="",  # guest cannot login with password
        )
        db.add(guest)
        await db.commit()
        await db.refresh(guest)
    return guest


async def get_current_user_or_guest(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """返回已登录用户；未登录则返回游客用户"""
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id: str = payload.get("sub", "")
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user:
                return user
        except JWTError:
            pass  # token invalid → fall through to guest

    return await _get_or_create_guest(db)
