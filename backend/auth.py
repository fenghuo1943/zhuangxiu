import time
import uuid
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .database import get_db
from .models import User
from .config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_DAYS, REFRESH_SECRET, REFRESH_TOKEN_EXPIRE_DAYS

security = HTTPBearer()

# 刷新令牌轮换宽限期缓存：token -> 最近使用时间（unix 秒）。
# 被轮换掉的旧刷新令牌在宽限期内仍视为有效，避免多标签页并发刷新时被误登出。
_ROTATION_GRACE_SECONDS = 300  # 5 分钟
_recent_refresh_tokens: dict[str, float] = {}


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hash.encode("utf-8"))


def _create_token(user_id: str, token_type: str, expire_days: int, secret: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=expire_days)
    # jti 随机声明：确保同一秒内签发的令牌也各不相同（轮换唯一，支持宽限期缓存）
    payload = {"sub": user_id, "type": token_type, "exp": expire, "jti": str(uuid.uuid4())}
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def create_access_token(user_id: str) -> str:
    """短期访问令牌（JWT_EXPIRE_DAYS 天）。"""
    return _create_token(user_id, "access", JWT_EXPIRE_DAYS, JWT_SECRET)


def create_refresh_token(user_id: str) -> str:
    """长期刷新令牌（REFRESH_TOKEN_EXPIRE_DAYS 天），每次刷新时轮换。"""
    return _create_token(user_id, "refresh", REFRESH_TOKEN_EXPIRE_DAYS, REFRESH_SECRET)


def _prune_refresh_cache() -> None:
    cutoff = time.time() - _ROTATION_GRACE_SECONDS
    for t in [t for t, ts in _recent_refresh_tokens.items() if ts < cutoff]:
        _recent_refresh_tokens.pop(t, None)


def decode_refresh_token(token: str) -> dict:
    """解码并校验刷新令牌（含轮换宽限期），失败抛 401。

    宽限期规则：未登记过的令牌（正常首次使用）一律有效；
    已登记过的令牌只在最近 5 分钟内仍有效，超时视为已轮换失效（防旧令牌重放）。
    """
    try:
        payload = jwt.decode(token, REFRESH_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise JWTError("not a refresh token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的刷新令牌")
    last_used = _recent_refresh_tokens.get(token)
    if last_used is not None and (time.time() - last_used) > _ROTATION_GRACE_SECONDS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="刷新令牌已失效，请重新登录")
    return payload


def mark_refresh_token_used(token: str) -> None:
    """登记刷新令牌刚刚被使用，进入宽限期；并顺带清理过期条目。"""
    _recent_refresh_tokens[token] = time.time()
    _prune_refresh_cache()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        # 拒绝把刷新令牌当访问令牌使用；缺失 type 的旧令牌视为 access（向后兼容）
        if payload.get("type", "access") != "access":
            raise JWTError("not an access token")
        user_id: str = payload.get("sub", "")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的认证令牌")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")
    return user


async def require_admin(
    user: User = Depends(get_current_user),
) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可执行此操作")
    return user
