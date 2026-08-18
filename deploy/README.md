# 群晖 NAS 部署指南

## 架构

```
前端（nginx）      后端（FastAPI）
:80/443            :8003（容器内部）
    │                  │
    └── /api/* ──────► │
    │                  │
    └── 静态文件       └── MySQL
```

## 快速部署

### 1. 准备工作

- 开启群晖 SSH
- 安装 Container Manager（Docker）
- 确认网络：群晖与 MySQL 服务器（192.168.31.146）在同一局域网

### 2. 上传代码

将项目代码上传到群晖，例如 `/volume1/zhuangxiu/`

### 3. 配置环境变量

```sh
cd /volume1/zhuangxiu/deploy
cp .env.example .env
# 编辑 .env，修改数据库连接等配置
nano .env
```

### 4. 构建前端

```sh
cd /volume1/zhuangxiu/frontend
npm ci
npm run build
```

### 5. 启动服务

```sh
cd /volume1/zhuangxiu/deploy
docker compose up -d
```

### 6. 访问

- 局域网：`http://群晖IP:8007`
- 外网：通过域名反向代理到 `http://群晖IP:8007`

## 日常运维

| 操作 | 命令 |
|------|------|
| 查看日志 | `docker compose logs -f` |
| 重启服务 | `docker compose restart` |
| 停止服务 | `docker compose down` |
| 更新前端 | 修改代码后重新 `npm run build`，然后 `docker compose restart frontend` |
| 更新后端 | 修改代码后 `docker compose restart backend` |

## 常见问题

- **端口被占用**：修改 `.env` 中的 `WEB_PORT`
- **数据库连接失败**：检查 `DATABASE_URL` 配置
- **API 请求走内网地址**：确保前端构建时 `VITE_API_BASE` 为空或相对路径

## 文件说明

```
deploy/
├── docker-compose.yml    服务编排
├── backend-entrypoint.sh 后端启动脚本
├── nginx.conf           nginx 配置
├── .env.example         配置模板
└── README.md            本文件
```
