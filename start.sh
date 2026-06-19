#!/usr/bin/env bash
# NOTE: No set -e — we handle errors explicitly

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 部署启动脚本
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 定位项目根目录
PROJECT_ROOT="${COZE_WORKSPACE_PATH:-}"
if [ -z "$PROJECT_ROOT" ] || [ ! -d "$PROJECT_ROOT/backend" ]; then
  PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

echo "[start] === Diagnostics ==="
echo "[start] Project root: $PROJECT_ROOT"
echo "[start] PWD: $(pwd)"
echo "[start] DEPLOY_RUN_PORT: ${DEPLOY_RUN_PORT:-5000}"
echo "[start] NODE_ENV: ${NODE_ENV:-not set}"
echo "[start] node: $(node --version)"
echo "[start] COZE_WORKSPACE_PATH: ${COZE_WORKSPACE_PATH:-not set}"

# 检查关键目录和文件
echo "[start] backend/node_modules: $([ -d "$PROJECT_ROOT/backend/node_modules" ] && echo 'EXISTS' || echo 'MISSING')"
echo "[start] frontend/dist: $([ -d "$PROJECT_ROOT/frontend/dist" ] && echo 'EXISTS' || echo 'MISSING')"
echo "[start] frontend/dist/index.html: $([ -f "$PROJECT_ROOT/frontend/dist/index.html" ] && echo 'EXISTS' || echo 'MISSING')"
echo "[start] backend/prisma/schema.prisma: $([ -f "$PROJECT_ROOT/backend/prisma/schema.prisma" ] && echo 'EXISTS' || echo 'MISSING')"

if [ ! -d "$PROJECT_ROOT/backend/node_modules" ]; then
  echo "[start] ERROR: backend/node_modules not found at $PROJECT_ROOT/backend"
  echo "[start] ERROR: Build step may have failed"
  exit 1
fi

# NOTE: Do NOT run prisma db push at runtime — production fs is read-only (EROFS).
# Database is initialized during build.sh (prisma db push runs there).
# server.js will create the DB on first connect if needed via ensureDatabase().

export NODE_ENV=production
export DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-5000}"

# 必须从 backend/ 目录启动，因为 server.js 用 process.cwd() 定位 ../frontend/dist
cd "$PROJECT_ROOT/backend"
echo "[start] CWD: $(pwd)"
echo "[start] Starting server on port $DEPLOY_RUN_PORT..."
exec node src/server.js
