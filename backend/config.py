import os

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+aiomysql://renovation:Wzcx131130_@192.168.31.146:3307/renovation")
JWT_SECRET = os.getenv("JWT_SECRET", "xiaozhuangjia-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "60"))
REFRESH_SECRET = os.getenv("REFRESH_SECRET", "xiaozhuangjia-refresh-secret-dev")
