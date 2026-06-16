#!/usr/bin/env bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 部署构建脚本 — 健壮路径 + 可选 Baileys
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 定位项目根目录：优先用环境变量，其次用脚本位置
PROJECT_ROOT="${COZE_WORKSPACE_PATH:-}"
if [ -z "$PROJECT_ROOT" ] || [ ! -d "$PROJECT_ROOT/backend" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$SCRIPT_DIR"
fi

# 再次确认项目根目录有效性
if [ ! -d "$PROJECT_ROOT/backend" ] || [ ! -d "$PROJECT_ROOT/frontend" ]; then
  echo "[build] ERROR: Cannot locate project root. Tried: $PROJECT_ROOT"
  echo "[build] ERROR: Ensure backend/ and frontend/ directories exist."
  exit 1
fi

echo "[build] Project root: $PROJECT_ROOT"
cd "$PROJECT_ROOT"

# ─── 网络重试配置 ───
export npm_config_fetch_timeout=120000
export npm_config_fetch_retries=5
export npm_config_fetch_retry_mintimeout=30000
export npm_config_fetch_retry_maxtimeout=120000

# ─── 1. 安装后端依赖 ───
echo "[build] Installing backend dependencies..."
(cd "$PROJECT_ROOT/backend" && pnpm install --no-frozen-lockfile 2>&1) || {
  echo "[build] WARNING: pnpm install failed, retrying without optional deps..."
  (cd "$PROJECT_ROOT/backend" && pnpm install --no-frozen-lockfile --ignore-scripts 2>&1) || {
    echo "[build] ERROR: Backend install failed even with --ignore-scripts"
    exit 1
  }
}

# ─── 2. 生成 Prisma 客户端 ───
echo "[build] Generating Prisma client..."
(cd "$PROJECT_ROOT/backend" && npx prisma generate 2>&1) || {
  echo "[build] ERROR: Prisma generate failed"
  exit 1
}

# ─── 3. 推送数据库 Schema ───
echo "[build] Pushing database schema..."
(cd "$PROJECT_ROOT/backend" && npx prisma db push 2>&1) || {
  echo "[build] WARNING: prisma db push failed (may be okay if DB already exists)"
}

# ─── 4. 检查 Baileys 是否可用 ───
BAILEYS_AVAILABLE=false
if (cd "$PROJECT_ROOT/backend" && node -e "import('@whiskeysockets/baileys').then(()=>console.log('OK')).catch(()=>{throw new Error('FAIL')})" 2>&1 | grep -q "OK"); then
  BAILEYS_AVAILABLE=true
  echo "[build] Baileys WhatsApp library: AVAILABLE"
else
  echo "[build] WARNING: Baileys WhatsApp library: NOT AVAILABLE (WhatsApp features disabled)"
  echo "[build]          The app will still start, but WhatsApp features won't work."
fi

# ─── 5. 安装前端依赖 ───
echo "[build] Installing frontend dependencies..."
(cd "$PROJECT_ROOT/frontend" && pnpm install --no-frozen-lockfile 2>&1) || {
  echo "[build] ERROR: Frontend install failed"
  exit 1
}

# ─── 6. 构建前端 ───
echo "[build] Building frontend..."
(cd "$PROJECT_ROOT/frontend" && pnpm build 2>&1) || {
  echo "[build] ERROR: Frontend build failed"
  exit 1
}

echo "[build] ============================================"
echo "[build] Build complete!"
echo "[build] Baileys: $BAILEYS_AVAILABLE"
echo "[build] ============================================"
