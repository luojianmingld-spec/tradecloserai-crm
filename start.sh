#!/usr/bin/env bash
set -e

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 部署启动脚本
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 定位项目根目录
PROJECT_ROOT="${COZE_WORKSPACE_PATH:-}"
if [ -z "$PROJECT_ROOT" ] || [ ! -d "$PROJECT_ROOT/backend" ]; then
  PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

if [ ! -d "$PROJECT_ROOT/backend/node_modules" ]; then
  echo "[start] ERROR: backend/node_modules not found at $PROJECT_ROOT/backend"
  echo "[start] ERROR: Build step may have failed"
  exit 1
fi

export NODE_ENV=production

echo "[start] Project root: $PROJECT_ROOT"
echo "[start] DEPLOY_RUN_PORT: ${DEPLOY_RUN_PORT:-5000}"
echo "[start] node: $(node --version)"

# 必须从 backend/ 目录启动，因为 server.js 用 process.cwd() 定位 ../frontend/dist
cd "$PROJECT_ROOT/backend"
exec node src/server.js
