# ASKUARY API（NestJS + Prisma + SQLite）

友联申请、评论与**文章/碎念入库发布**后端。管理页：部署后访问 `/admin/`，用 `ADMIN_TOKEN` 作为登录密码。

## 本地开发

```bash
cd api
cp .env.example .env   # 改 ADMIN_TOKEN（即登录密码）
npm install
npx prisma migrate deploy
npm run start:dev
```

- 健康检查：`GET http://127.0.0.1:8787/api/health`
- 管理登录：`http://127.0.0.1:8787/admin/`（密码 = `ADMIN_TOKEN`；成功后只存短时会话票）
- 生产：compose 绑 `127.0.0.1:8787`，Nginx 样例见仓库 `docs/nginx-askuary.example.conf`
- 必填 `CORS_ORIGINS`；可选 `ADMIN_SESSION_HOURS`、`ALLOW_RAW_ADMIN_TOKEN=0`、审计见 `data/audit.log`

## Docker 部署

在仓库根目录：

```bash
# 编辑 api/.env，设置强随机 ADMIN_TOKEN 与 CORS_ORIGINS
# 本地开发 DATABASE_URL 可用 file:../data/askuary.db
# compose 会覆盖为 file:/app/data/askuary.db 并挂载 ./api/data
docker compose up -d --build
```

### 数据会不会被 rebuild 清掉？

**不会**——前提是库文件在宿主机 `api/data/askuary.db`：

| 路径 | 内容 |
|------|------|
| `./api/data/` | SQLite（光点、文章、碎念、摄影故事、馆藏、评论…） |
| `./api/covers/` | 随机封面图库 |

`docker compose up -d --build` 只重建镜像，**不会**删这两个目录。

注意：

- 不要用 `docker compose down -v`（会删 named volume；本仓库已改绑宿主机目录，一般也更安全）
- 不要用空的 `api/data` 整夹覆盖服务器上的同名目录
- 换机器前先备份 `api/data/askuary.db`

若旧版本曾把库写进镜像内 `/app/prisma/data/`，新入口脚本会在首次启动时自动迁到 `/app/data/`。也可从旧 named volume 救出：

```bash
# 卷名因项目目录而异，先 docker volume ls | grep askuary
docker run --rm \
  -v askuary-portal_askuary-api-data:/from \
  -v "$(pwd)/api/data:/to" \
  alpine sh -c 'cp -a /from/. /to/ && ls -la /to'
```

反代示例（Caddy）：

```
api.askuary.cn {
  reverse_proxy 127.0.0.1:8787
}
```

## 前台配置

在 `data/friends-page.json`（及 `public/data/`）设置：

```json
"apiBase": "https://api.askuary.cn"
```

然后重新 `npm run build` 部署静态站 `dist/`。

## 主要接口

| GET | `/api/friends` | 已通过友链（公开） |
| GET | `/api/friend-applications` | 公开申请列表 |
| GET | `/api/friend-applications/check-exists?url=` | URL 是否已申请 |
| POST | `/api/friend-applications` | 提交申请 |
| PATCH | `/api/friend-applications/:id` | 审核（可带 rejectReason） |
| GET | `/api/comments?path=` | 公开仅已发布；Admin 带头可筛 status |
| POST | `/api/comments` | 发表（默认待审） |
| PATCH | `/api/comments/:id/status` | 通过/待审（需 Admin） |
| DELETE | `/api/comments/:id` | 删评（需 Admin） |
| GET | `/api/content?kind=&status=` | 内容列表；公开仅 published；Admin 可看 draft |
| GET | `/api/content/:kind/:slug` | 内容详情（kind=`journal`\|`blog`） |
| POST | `/api/content` | 创建（需 Admin） |
| PATCH | `/api/content/:id` | 更新/发布/改草稿（需 Admin） |
| DELETE | `/api/content/:id` | 删除（需 Admin） |

### 写作约定

| mode | kind | 说明 |
|------|------|------|
| `article` | journal | 主页长文（不含碎念标签） |
| `shuoshuo` | journal | 碎念（自动确保 tags 含「碎念」） |
| `blog` | blog | 宇宙博客 |

前台需配置 `data/site.json` 的 `apiBase`，才会把 API 已发布内容合并进主页/碎念/博客列表。API 文章详情走 `/journal/view/?slug=`、`/blog/view/?slug=`。

## curl 示例

```bash
# 通过申请
curl -X PATCH https://api.askuary.cn/api/friend-applications/ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved"}'

# 发布一篇碎念
curl -X POST https://api.askuary.cn/api/content \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"kind":"journal","mode":"shuoshuo","title":"今天","markdown":"随手记一句。","status":"published"}'
```

