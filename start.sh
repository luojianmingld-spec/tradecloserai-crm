#!/usr/bin/env bash
set -e

# 部署启动脚本

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

export NODE_ENV=production

echo "[start] Project root: $SCRIPT_DIR"
echo "[start] DEPLOY_RUN_PORT=${DEPLOY_RUN_PORT:-5000}"
echo "[start] Starting production server..."

cd backend && exec node src/server.js
