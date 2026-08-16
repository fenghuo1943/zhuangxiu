#!/bin/sh
# ============================================================
#  小装家 · 群晖 NAS 部署脚本
#  代码直接映射 NAS 硬盘；后端 python:3.13-slim，前端 nginx:alpine
#
#  用法：
#    ./deploy.sh up        首次部署 / 启动（前端未构建或地址变了会自动构建）
#    ./deploy.sh build     重新构建前端（改了 VITE_API_BASE 后执行）
#    ./deploy.sh restart   重启容器（改了后端代码后执行）
#    ./deploy.sh logs      查看实时日志
#    ./deploy.sh down      停止并删除容器（数据卷保留）
# ============================================================
set -e
cd "$(dirname "$0")"

# ---------- 1. 检查 docker / compose ----------
if ! command -v docker >/dev/null 2>&1; then
  echo "错误：未找到 docker 命令。"
  echo "请先在群晖「套件中心」安装 Container Manager（Docker）。"
  exit 1
fi
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "错误：未找到 docker compose。请升级 Container Manager 或安装 docker-compose。"
  exit 1
fi

# ---------- 2. 首次部署：生成 .env ----------
if [ ! -f .env ]; then
  echo "==> 首次部署：生成 deploy/.env ..."
  cp .env.example .env

  gen_secret() {
    if command -v openssl >/dev/null 2>&1; then
      openssl rand -hex 32
    else
      cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 48
    fi
  }
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(gen_secret)|" .env
  sed -i "s|^REFRESH_SECRET=.*|REFRESH_SECRET=$(gen_secret)|" .env

  NAS_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  case "$NAS_IP" in
    10.*|192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*)
      ;;
    *)
      printf "未能自动识别局域网 IP，请输入群晖 IP（如 192.168.31.100）: "
      read NAS_IP
      ;;
  esac
  NAS_IP=${NAS_IP:-127.0.0.1}

  sed -i "s|^VITE_API_BASE=.*|VITE_API_BASE=http://${NAS_IP}:8080|" .env
  echo "    已写入局域网 IP：${NAS_IP}"
  echo "    ⚠️  请检查 deploy/.env，特别是 DATABASE_URL 是否正确。"
  echo
else
  echo "==> 使用已有配置 deploy/.env（如需修改请编辑后重新运行）"
fi

VITE_API_BASE=$(grep -E '^VITE_API_BASE=' .env | cut -d= -f2)

# ---------- 3. 执行子命令 ----------
CMD="${1:-up}"
case "$CMD" in
  up)
    # 前端 dist 缺失，或 VITE_API_BASE 与上次构建不同 → 需要重新构建
    NEED_BUILD=0
    if [ ! -f ../frontend/dist/index.html ]; then
      NEED_BUILD=1
    elif [ ! -f .last-vite-base ] || [ "$(cat .last-vite-base)" != "$VITE_API_BASE" ]; then
      NEED_BUILD=1
    fi
    if [ "$NEED_BUILD" = 1 ]; then
      ./build-frontend.sh
      echo "$VITE_API_BASE" > .last-vite-base
    fi
    echo "==> 启动容器..."
    $COMPOSE up -d
    ;;
  build)
    ./build-frontend.sh
    echo "$VITE_API_BASE" > .last-vite-base
    ;;
  restart)
    $COMPOSE restart
    ;;
  logs)
    $COMPOSE logs -f --tail=100
    ;;
  down)
    $COMPOSE down
    ;;
  *)
    echo "用法: $0 [up|build|restart|logs|down]"
    exit 1
    ;;
esac

# ---------- 4. 输出访问地址 ----------
if [ "$CMD" = "up" ] || [ "$CMD" = "restart" ]; then
  WEB_PORT=$(grep -E '^WEB_PORT=' .env | cut -d= -f2)
  WEB_PORT=${WEB_PORT:-8080}
  echo
  echo "============================================================"
  echo "  部署完成！"
  echo "  浏览器访问: ${VITE_API_BASE}"
  echo "  健康检查:   curl http://127.0.0.1:${WEB_PORT}/api/health"
  echo "  查看日志:   ./deploy.sh logs"
  echo "  停止服务:   ./deploy.sh down"
  echo "============================================================"
fi
