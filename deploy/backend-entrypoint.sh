#!/bin/sh
# 后端容器启动脚本：
#   每次启动都会计算 requirements.txt 的校验和，与上次安装时记录的校验和比对：
#     - 首次启动 / 依赖卷被清空 / requirements.txt 有变化 → 重新安装依赖
#     - 无变化 → 直接启动，重启为秒级
#   校验和记录在 /app/venv/.deps-ok（依赖持久化卷内）。
set -e
cd /app

# 计算当前 requirements.txt 的校验和（无校验和工具时退化为按 mtime 判断）
if command -v md5sum >/dev/null 2>&1; then
  REQ_SUM=$(md5sum backend/requirements.txt | awk '{print $1}')
  CHK="md5"
elif command -v sha1sum >/dev/null 2>&1; then
  REQ_SUM=$(sha1sum backend/requirements.txt | awk '{print $1}')
  CHK="sha1"
else
  REQ_SUM=""
  CHK="mtime"
fi

# 判断是否需要（重新）安装依赖
NEED_INSTALL=0
if [ ! -d venv/bin ]; then
  NEED_INSTALL=1        # venv 不存在（首次启动）
elif [ ! -f venv/.deps-ok ]; then
  NEED_INSTALL=1        # 安装记录丢失
elif [ "$CHK" = "mtime" ]; then
  if [ backend/requirements.txt -nt venv/.deps-ok ]; then
    NEED_INSTALL=1      # requirements.txt 比记录新
  fi
else
  if [ "$(cat venv/.deps-ok 2>/dev/null)" != "$REQ_SUM" ]; then
    NEED_INSTALL=1      # requirements.txt 校验和与上次不同
  fi
fi

if [ "$NEED_INSTALL" = 1 ]; then
  echo "==> requirements.txt 有变化或依赖未就绪，正在安装/更新依赖（首次约 1-2 分钟）..."
  python -m venv venv
  venv/bin/pip install --no-cache-dir -r backend/requirements.txt
  if [ "$CHK" = "mtime" ]; then
    touch venv/.deps-ok
  else
    echo "$REQ_SUM" > venv/.deps-ok
  fi
  echo "==> 依赖安装完成。"
else
  echo "==> 依赖已就绪（requirements.txt 无变化），跳过安装。"
fi

echo "==> 启动 FastAPI 服务（:8003）..."
exec venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8003
