#!/usr/bin/env bash
set -e

# 部署启动脚本
# 工作目录：项目根目录（由部署系统保证）

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

export NODE_ENV=production

echo "[start] Starting production server..."
cd backend && exec node src/server.js
