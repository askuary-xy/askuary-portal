#!/bin/sh
# 保证 SQLite 落在 /app/data（compose 卷），避免写进镜像层被 rebuild 清掉
set -e
mkdir -p /app/data /app/data/arcade-uploads

OLD_DB="/app/prisma/data/askuary.db"
NEW_DB="/app/data/askuary.db"

if [ -f "$OLD_DB" ] && [ ! -f "$NEW_DB" ]; then
  echo "[askuary] 发现旧库路径 $OLD_DB，迁移到 $NEW_DB"
  cp -a "$OLD_DB" "$NEW_DB"
  [ -f "${OLD_DB}-wal" ] && cp -a "${OLD_DB}-wal" "${NEW_DB}-wal" || true
  [ -f "${OLD_DB}-shm" ] && cp -a "${OLD_DB}-shm" "${NEW_DB}-shm" || true
fi

npx prisma migrate deploy || npx prisma db push
exec node dist/main.js
