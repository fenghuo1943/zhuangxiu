import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./xiaozhuangjia.db")
JWT_SECRET = os.getenv("JWT_SECRET", "xiaozhuangjia-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7
