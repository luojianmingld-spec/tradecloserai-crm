#!/usr/bin/env bash
set -e

# 部署构建脚本
# 通过 SCRIPT_DIR 确保在项目根目录执行

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "[build] Project root: $SCRIPT_DIR"

# 配置 pnpm 网络超时（Baileys 的 GitHub 依赖可能慢）
export npm_config_fetch_timeout=120000
export npm_config_fetch_retries=5
export npm_config_fetch_retry_mintimeout=30000
export npm_config_fetch_retry_maxtimeout=120000

echo "[build] Installing backend dependencies..."
(cd backend && pnpm install --no-frozen-lockfile)

echo "[build] Generating Prisma client..."
(cd backend && npx prisma generate)

echo "[build] Pushing database schema..."
(cd backend && npx prisma db push || true)

echo "[build] Installing frontend dependencies..."
(cd frontend && pnpm install --no-frozen-lockfile)

echo "[build] Building frontend..."
(cd frontend && pnpm build)

echo "[build] Done!"
