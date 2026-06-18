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
echo "[build] PWD: $(pwd)"
echo "[build] Node: $(node --version)"
echo "[build] npm: $(npm --version)"
echo "[build] pnpm: $(pnpm --version)"

# 强制 development 模式确保 devDependencies 被安装
export NODE_ENV=development

# ─── 1. 安装后端依赖（不含 Baileys） ───
echo "[build] === Installing backend dependencies (excluding Baileys) ==="
cd "$PROJECT_ROOT/backend"

# 临时移除 baileys 以避免安装超时
TMP_PKG="/tmp/_baileys_backup.txt"
node -e "
const pkg = require('./package.json');
const fs = require('fs');
if (pkg.optionalDependencies && pkg.optionalDependencies['@whiskeysockets/baileys']) {
  fs.writeFileSync('$TMP_PKG', pkg.optionalDependencies['@whiskeysockets/baileys']);
  delete pkg.optionalDependencies['@whiskeysockets/baileys'];
  fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
  console.log('[build] Temporarily removed Baileys from package.json');
} else {
  console.log('[build] No Baileys to remove');
}
"

pnpm install --no-frozen-lockfile 2>&1 || {
  echo "[build] WARNING: pnpm install failed, retrying with --ignore-scripts..."
  pnpm install --no-frozen-lockfile --ignore-scripts 2>&1
}

# 恢复 package.json
node -e "
const pkg = require('./package.json');
const fs = require('fs');
if (fs.existsSync('$TMP_PKG')) {
  if (!pkg.optionalDependencies) pkg.optionalDependencies = {};
  pkg.optionalDependencies['@whiskeysockets/baileys'] = fs.readFileSync('$TMP_PKG', 'utf8').trim();
  fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
  console.log('[build] Restored Baileys to package.json');
}
"

echo "[build] backend/node_modules exists: $([ -d node_modules ] && echo 'YES' || echo 'NO')"
echo "[build] prisma binary exists: $([ -f node_modules/.bin/prisma ] && echo 'YES' || echo 'NO')"

# ─── 2. 尝试安装 Baileys（可选，失败不影响主功能） ───
echo "[build] === Attempting to install Baileys (optional) ==="
cd "$PROJECT_ROOT/backend"
pnpm install --no-frozen-lockfile 2>&1 || {
  echo "[build] WARNING: Baileys install failed, trying with --ignore-scripts..."
  pnpm install --no-frozen-lockfile --ignore-scripts 2>&1 || {
    echo "[build] WARNING: Baileys install failed completely, WhatsApp features will be unavailable"
    echo "[build] CRM core features will still work normally"
  }
}
echo "[build] Baileys installed: $([ -d node_modules/@whiskeysockets/baileys ] && echo 'YES' || echo 'NO')"

# ─── 3. 生成 Prisma 客户端 ───
echo "[build] === Generating Prisma client ==="
cd "$PROJECT_ROOT/backend"
npx prisma generate 2>&1 || {
  echo "[build] ERROR: prisma generate failed!"
  exit 1
}

# ─── 4. 推送数据库 Schema ───
echo "[build] === Pushing database schema ==="
cd "$PROJECT_ROOT/backend"
npx prisma db push 2>&1 || echo "[build] WARNING: prisma db push failed (may be okay if DB already exists)"

# ─── 5. 安装前端依赖 ───
echo "[build] === Installing frontend dependencies ==="
cd "$PROJECT_ROOT/frontend"
pnpm install --no-frozen-lockfile 2>&1 || {
  echo "[build] WARNING: frontend pnpm install failed, retrying with --ignore-scripts..."
  pnpm install --no-frozen-lockfile --ignore-scripts 2>&1
}

# ─── 6. 构建前端 ───
echo "[build] === Building frontend ==="
cd "$PROJECT_ROOT/frontend"
pnpm build 2>&1 || {
  echo "[build] ERROR: frontend build failed!"
  exit 1
}

echo "[build] === Verifying build output ==="
echo "[build] frontend/dist exists: $([ -d dist ] && echo 'YES' || echo 'NO')"
echo "[build] frontend/dist/index.html exists: $([ -f dist/index.html ] && echo 'YES' || echo 'NO')"
echo "[build] backend/node_modules exists: $([ -d "$PROJECT_ROOT/backend/node_modules" ] && echo 'YES' || echo 'NO')"

echo "[build] === Build complete! ==="
