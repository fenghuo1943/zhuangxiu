# 群晖 NAS 部署指南（代码映射 NAS 硬盘 + Docker Compose）

前后端用 Docker Compose 部署到群晖 NAS，**代码和构建产物直接映射到 NAS 硬盘**，容器用官方基础镜像：

- **后端**：`python:3.13-slim`，源码挂载 `/volume1/.../backend`，依赖装在持久化卷里
- **前端**：`nginx:alpine`，构建产物 `dist` 挂载为静态文件目录，反向代理 `/api`
- **数据库**：复用现有 MySQL（`192.168.31.146:3307`），数据不迁移

## 架构

```
NAS 硬盘                                 容器
backend/            ──ro 挂载──►  python:3.13-slim
                                    ├─ venv 卷（Python 依赖，持久化）
                                    └─ 首次启动自动 pip install + uvicorn :8003
                                    连现有 MySQL

frontend/dist       ──ro 挂载──►  nginx:alpine  :80
                                    ├─ /api/*  ──► backend 容器
                                    └─ /assets/flow-images/*  ← uploads 卷（与后端共享）
```

改代码后：后端 `./deploy.sh restart`，前端 `./deploy.sh build` 再 `restart`，**无需重建镜像**。

## 一、准备工作（一次性）

1. **开启群晖 SSH**：控制面板 → 终端机和 SNMP → 终端机 → 勾选「启动 SSH 功能」。
2. **安装 Container Manager**：套件中心 → 搜索「Container Manager」→ 安装。
3. **确认网络**：群晖与 `192.168.31.146` 同一局域网，3307 端口可连通。
4. 首次构建/启动需**联网**（拉取基础镜像、`pip install`、`npm ci`）。

## 二、把项目代码放到群晖

**方式 A（推荐，有 GitHub 远端）**

```sh
ssh 用户名@群晖IP
cd /volume1
git clone https://github.com/fenghuo1943/zhuangxiu.git
cd zhuangxiu
```

**方式 B（没有远端 / 不想用 git）**：在 Windows 上把以下内容打包上传到群晖并解压：

```
backend/
frontend/
deploy/
.dockerignore
```

> 不要打包 `venv`、`frontend/node_modules`、`frontend/dist`，不需要且体积大。

## 三、部署

```sh
cd /volume1/zhuangxiu/deploy
chmod +x deploy.sh build-frontend.sh backend-entrypoint.sh
./deploy.sh up
```

首次运行 `./deploy.sh up` 会：

1. 生成 `deploy/.env`（识别群晖局域网 IP、生成随机 JWT 密钥）
2. 若 `frontend/dist` 不存在，用一次性 node 容器自动构建前端（写入 NAS 硬盘）
3. 启动后端容器：首次自动创建 venv 并安装依赖（约 1-2 分钟），再启动 uvicorn
4. 启动前端 nginx 容器

完成后浏览器访问 **`http://群晖IP:8080`**。

## 四、日常更新（关键！代码映射的好处）

| 改动 | 操作 |
| --- | --- |
| 改后端代码 | NAS 上 `git pull`（或直接改文件）→ `./deploy.sh restart` |
| 改后端 `requirements.txt` | 重启容器即可，启动脚本会自动比对校验和并重新安装依赖（无需手动操作） |
| 改前端代码 | NAS 上改完 → `./deploy.sh build` → `./deploy.sh restart` |
| 改 `VITE_API_BASE` / 端口 | 编辑 `deploy/.env` → `./deploy.sh up`（自动检测到地址变化并重新构建） |
| 改 `DATABASE_URL` / 密钥 | 编辑 `deploy/.env` → `./deploy.sh restart` |

> ⚠️ 修改 `JWT_SECRET` / `REFRESH_SECRET` 会让已登录用户的令牌失效，需重新登录一次。

## 五、配置项（deploy/.env）

| 配置项 | 说明 |
| --- | --- |
| `VITE_API_BASE` | 站点访问地址，前端构建时写死 |
| `WEB_PORT` | 前端对外端口，默认 8080 |
| `DATABASE_URL` | MySQL 连接串 |
| `TZ` | 时区，默认 `Asia/Shanghai` |
| `JWT_SECRET` / `REFRESH_SECRET` | 签名密钥（首次部署自动生成） |

## 六、运维命令

```sh
./deploy.sh logs      # 实时日志
./deploy.sh restart   # 重启容器
./deploy.sh build     # 手动重新构建前端
./deploy.sh down      # 停止并删除容器（uploads / backend-venv 数据卷保留）
```

## 七、常见问题

- **8080 端口被占用**：修改 `deploy/.env` 的 `WEB_PORT`，重新 `./deploy.sh up`。
- **连不上数据库**：确认群晖能 ping 通 `192.168.31.146`、3307 端口开放、`DATABASE_URL` 用户名密码正确。
- **首次启动很慢 / 一直 healthcheck**：后端首次要 `pip install`，属正常；看日志 `./deploy.sh logs backend`。
- **构建前端报错 / 产物是 root 属主**：node 容器以 root 运行，`dist`、`node_modules` 属主为 root，nginx 读取不受影响；要删除可用 `sudo rm -rf`。
- **图片上传失败**：上传大小限制 20M；确认两个容器都挂了 `uploads` 卷（`./deploy.sh logs backend`）。
- **想用域名 / HTTPS 访问**：群晖 控制面板 → 登录门户 → 高级 → 反向代理，把域名反向代理到 `http://127.0.0.1:8080`；同时把 `deploy/.env` 的 `VITE_API_BASE` 改成该域名并重新 `./deploy.sh up`。

## 目录说明

```
deploy/
├── deploy.sh            一键部署 / 运维脚本
├── docker-compose.yml   服务编排（bind-mount 到 NAS 硬盘）
├── backend-entrypoint.sh 后端启动脚本（装依赖 + 起 uvicorn）
├── build-frontend.sh    用一次性 node 容器构建前端
├── nginx.conf           前端 nginx 配置
├── .env.example         配置模板（首次运行复制为 .env）
└── README.md            本文件
```

> `deploy/.env` 含数据库密码和 JWT 密钥，已被 `.gitignore` 忽略，不要提交到仓库。
