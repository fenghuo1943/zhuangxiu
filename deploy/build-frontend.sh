#!/bin/sh
# 在群晖上用一次性 node:22-alpine 容器构建前端（无需在 NAS 安装 Node）。
# 产物直接写入 ../frontend/dist，供 nginx:alpine 挂载使用。
# VITE_API_BASE 从 deploy/.env 读取（环境变量优先级高于 .env.local，已实测生效）。
set -e
cd "$(dirname "$0")"

# 读取 .env 中的 VITE_API_BASE
VITE_API_BASE=$(grep -E '^VITE_API_BASE=' .env 2>/dev/null | cut -d= -f2)
VITE_API_BASE=${VITE_API_BASE:-http://localhost:8080}

echo "==> 构建前端（VITE_API_BASE=${VITE_API_BASE}）..."
docker run --rm \
  -v "$(pwd)/../frontend:/app" \
  -w /app \
  -e "VITE_API_BASE=${VITE_API_BASE}" \
  node:22-alpine \
  sh -c "npm ci && npm run build"

echo "==> 构建完成：../frontend/dist"
echo "    （如需以当前系统用户属主输出，可删除 docker run 的参数：-u root，默认即 root）"
