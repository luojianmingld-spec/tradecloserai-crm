#!/usr/bin/env bash
set -e

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 部署构建脚本
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 定位项目根目录：优先 COZE_WORKSPACE_PATH，否则用脚本所在目录
PROJECT_ROOT="${COZE_WORKSPACE_PATH:-}"
if [ -z "$PROJECT_ROOT" ] || [ ! -d "$PROJECT_ROOT/backend" ]; then
  PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

# 校验项目结构
if [ ! -d "$PROJECT_ROOT/backend" ]; then
  echo "[build] ERROR: backend/ not found in $PROJECT_ROOT"
  exit 1
fi
if [ ! -d "$PROJECT_ROOT/frontend" ]; then
  echo "[build] ERROR: frontend/ not found in $PROJECT_ROOT"
  exit 1
fi

echo "[build] Project root: $PROJECT_ROOT"

# ─── 1. 安装后端依赖 ───
echo "[build] === Installing backend dependencies ==="
cd "$PROJECT_ROOT/backend"
pnpm install --no-frozen-lockfile

# ─── 2. 生成 Prisma 客户端 ───
echo "[build] === Generating Prisma client ==="
cd "$PROJECT_ROOT/backend"
npx prisma generate

# ─── 3. 推送数据库 Schema ───
echo "[build] === Pushing database schema ==="
cd "$PROJECT_ROOT/backend"
npx prisma db push || echo "[build] WARNING: prisma db push failed (may be okay if DB already exists)"

# ─── 4. 安装前端依赖 ───
echo "[build] === Installing frontend dependencies ==="
cd "$PROJECT_ROOT/frontend"
pnpm install --no-frozen-lockfile

# ─── 5. 构建前端 ───
echo "[build] === Building frontend ==="
cd "$PROJECT_ROOT/frontend"
pnpm build

echo "[build] === Build complete! ==="
