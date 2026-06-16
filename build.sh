#!/usr/bin/env bash
set -e

# 部署构建脚本
# 工作目录：项目根目录（由部署系统保证）

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "[build] Installing backend dependencies..."
cd backend && pnpm install && npx prisma generate && npx prisma db push && cd ..

echo "[build] Installing frontend dependencies and building..."
cd frontend && pnpm install && pnpm build && cd ..

echo "[build] Done!"
