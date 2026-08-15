# 方案 B：只在服务器构建

本机**不**跑 `npm run build`，只改内容或推代码；构建与发布都在服务器完成。

> 注意：方案 B 会把 `content/photowall` 原图放在服务器，体积大。  
> 若只想上线缩略图、原图留本机，请用 **方案 A**（本机 `npm run photowall:build`，只上传 `dist/photowall`）。

## 目录（不要混）

| 路径 | 用途 |
|------|------|
| `/www/wwwroot/askuary-portal/` | **完整仓库**（有 `package.json`、`content/`、`src/`） |
| `/www/wwwroot/118_89_196_45/` | **网站根**（只放构建后的 `dist/` 内容） |
| API 目录 + `docker compose` | 后端，与前台构建无关 |

网站根没有 `package.json` 时不要在那里执行 `npm`（会 ENOENT）。

## 首次部署

```bash
# 1) 上传/克隆完整仓库到独立目录
#    例如 git clone 或宝塔上传整个 askuary-portal

cd /www/wwwroot/askuary-portal
npm ci

# 2) 配置站点根并整站构建发布
chmod +x scripts/deploy-server.sh
export SITE_ROOT=/www/wwwroot/118_89_196_45
./scripts/deploy-server.sh
```

## 日常：只加摄影

```bash
# 把新图传到服务器：
#   /www/wwwroot/askuary-portal/content/photowall/...

cd /www/wwwroot/askuary-portal
export SITE_ROOT=/www/wwwroot/118_89_196_45
./scripts/deploy-server.sh photos
```

旧图未改动会跳过压缩；只同步站点的 `photowall/` 与 `data/photowall-index.json`。

## 日常：改文章 / 整站

```bash
cd /www/wwwroot/askuary-portal
export SITE_ROOT=/www/wwwroot/118_89_196_45
./scripts/deploy-server.sh        # = all
```

## 后台同步故事

站点有索引后，打开 `/admin/` → 摄影管理 →「从静态索引同步」。  
一般**不必** `docker compose --build`（除非改了 API 代码）。

### API 数据持久化（很重要）

后台改的光点 / 文章 / 摄影故事 / 馆藏都在 **SQLite**，不在静态 `dist/`。

```text
仓库/api/data/askuary.db   ← 真正的后台数据（compose 挂载）
仓库/api/covers/           ← 封面图库
```

- `docker compose up -d --build`：**可重建镜像，不会丢** `api/data`
- 上传/替换代码时：**不要覆盖或清空服务器上的 `api/data/`**
- 前台 `npm run build` / `deploy-server.sh` 只动网站根 `dist/`，**不动** API 数据库

若重建后光点消失，多半是旧版库写在镜像层里。拉新代码重建后，入口会尝试自动迁移；仍没有则按 `api/README.md` 从旧 Docker volume 拷出 `askuary.db`。

## API 安全（生产必做）

1. **只本机暴露端口**：`docker-compose.yml` 已绑 `127.0.0.1:8787:8787`。公网访问走 Nginx 反代，见 [`nginx-askuary.example.conf`](./nginx-askuary.example.conf)。
2. **环境变量**（`api/.env`，参考 `api/.env.example`）：
   - `ADMIN_TOKEN`：长随机 ASCII 主密钥（登录密码）；登录后浏览器只存短时会话票
   - `CORS_ORIGINS`：生产必填，逗号分隔允许源；留空则拒绝跨域
   - `ADMIN_SESSION_HOURS`：会话票有效小时数（默认 12）
   - `ALLOW_RAW_ADMIN_TOKEN`：设为 `0` 禁止用主密钥直接 Bearer（仅会话票）
3. **审计日志**：写操作与登录记录在 `api/data/audit.log`（JSONL，随 data 卷持久化）。
4. **限流**：登录约 5 次 / 15 分钟；公开评论 / 友联申请更严。反代须传 `X-Forwarded-For`（样例已含）。

重建 API：

```bash
cd /www/wwwroot/askuary-portal
docker compose up -d --build
```

## 馆藏管理（后台）

1. 部署含 `LibraryItem` / 街机 `Arcade*` 的 API（`prisma migrate` / `db push` 后重启容器；街机截图目录 `data/arcade-uploads`）
2. 打开 `/admin/` → **馆藏管理** →「从静态索引导入」（会请求站点 `/data/library.json`）
3. 之后增删改都在后台完成，前台 `/library/` 有 API 数据后以数据库为准
4. 封面可填 `/library/covers/xxx.jpg`（需先把封面文件部署到站点根）或外链

## 与方案 A 的区别

| | 方案 A 本机构建 | 方案 B 服务器构建 |
|--|----------------|-------------------|
| 构建位置 | 你的电脑 | 服务器仓库目录 |
| 上传内容 | `dist/` | 原图到 `content/photowall` 等 |
| 网站根执行 npm | 否 | 否（在仓库目录执行） |
