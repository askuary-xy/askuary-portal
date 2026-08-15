#!/usr/bin/env bash
# 方案 B：在服务器仓库目录构建，再发布到网站根目录
#
# 目录约定：
#   REPO=/www/wwwroot/askuary-portal     ← 完整仓库（有 package.json）
#   SITE=/www/wwwroot/118_89_196_45     ← 网站根（只放 dist 内容）
#
# 用法：
#   cd /www/wwwroot/askuary-portal
#   chmod +x scripts/deploy-server.sh
#   export SITE_ROOT=/www/wwwroot/118_89_196_45
#   ./scripts/deploy-server.sh           # 整站 build + 发布
#   ./scripts/deploy-server.sh photos    # 只构建摄影并发布 photowall + 索引
#   ./scripts/deploy-server.sh sync      # 不构建，仅把现有 dist 同步到站点
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SITE_ROOT="${SITE_ROOT:-}"
MODE="${1:-all}"

if [[ -z "$SITE_ROOT" ]]; then
  echo "请设置网站根目录，例如："
  echo "  export SITE_ROOT=/www/wwwroot/118_89_196_45"
  echo "  ./scripts/deploy-server.sh"
  exit 1
fi

if [[ ! -f "$ROOT/package.json" ]]; then
  echo "当前目录没有 package.json：$ROOT"
  echo "请把完整仓库放到独立目录（不要用网站根当仓库）。"
  exit 1
fi

if [[ ! -d "$SITE_ROOT" ]]; then
  echo "SITE_ROOT 不存在：$SITE_ROOT"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "[deploy] npm ci ..."
  npm ci
fi

case "$MODE" in
  all)
    echo "[deploy] npm run build ..."
    npm run build
    ;;
  photos|photowall)
    echo "[deploy] npm run photowall:build ..."
    npm run photowall:build
    ;;
  sync)
    echo "[deploy] skip build，仅同步 dist → SITE_ROOT"
    ;;
  *)
    echo "未知模式：$MODE（可用 all | photos | sync）"
    exit 1
    ;;
esac

if [[ ! -d "$ROOT/dist" ]]; then
  echo "没有 dist/，请先构建"
  exit 1
fi

echo "[deploy] sync dist → $SITE_ROOT"

if command -v rsync >/dev/null 2>&1; then
  if [[ "$MODE" == "photos" || "$MODE" == "photowall" ]]; then
    mkdir -p "$SITE_ROOT/photowall" "$SITE_ROOT/data"
    rsync -a --delete "$ROOT/dist/photowall/" "$SITE_ROOT/photowall/"
    cp -f "$ROOT/dist/data/photowall-index.json" "$SITE_ROOT/data/photowall-index.json"
  else
    rsync -a "$ROOT/dist/" "$SITE_ROOT/"
  fi
else
  if [[ "$MODE" == "photos" || "$MODE" == "photowall" ]]; then
    mkdir -p "$SITE_ROOT/photowall" "$SITE_ROOT/data"
    rm -rf "$SITE_ROOT/photowall"
    cp -a "$ROOT/dist/photowall" "$SITE_ROOT/photowall"
    cp -f "$ROOT/dist/data/photowall-index.json" "$SITE_ROOT/data/photowall-index.json"
  else
    cp -a "$ROOT/dist/." "$SITE_ROOT/"
  fi
fi

echo "[deploy] done."
echo "  仓库: $ROOT"
echo "  站点: $SITE_ROOT"
echo "  模式: $MODE"
