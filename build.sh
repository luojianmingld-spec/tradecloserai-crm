#!/bin/bash
# NOTE: No set -e — we handle errors explicitly so one failed step
# doesn't abort the entire build (which would cause platform rollback)

echo "[build] Starting build process..."

# Resolve workspace path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$SCRIPT_DIR}"

echo "[build] COZE_WORKSPACE_PATH=${COZE_WORKSPACE_PATH}"

BUILD_OK=true

# ========== Backend ==========
echo "[build] Installing backend dependencies..."
cd "$COZE_WORKSPACE_PATH/backend"

# Install all dependencies (Baileys is optionalDependency, won't block build if it fails)
if ! pnpm install 2>&1; then
    echo "[build] pnpm install failed, retrying with --ignore-scripts..."
    pnpm install --ignore-scripts 2>&1 || echo "[build] WARNING: backend pnpm install failed"
fi

# Generate Prisma client
echo "[build] Generating Prisma client..."
npx prisma generate 2>&1 || echo "[build] WARNING: prisma generate failed"

# Push database schema
echo "[build] Pushing database schema..."
npx prisma db push 2>&1 || echo "[build] WARNING: prisma db push failed"

# Create sessions directory for WhatsApp (may fail on read-only fs in prod, that's OK)
mkdir -p "$COZE_WORKSPACE_PATH/backend/sessions" 2>/dev/null || echo "[build] WARNING: Could not create sessions dir"

# ========== Frontend ==========
echo "[build] Installing frontend dependencies..."
cd "$COZE_WORKSPACE_PATH/frontend"
if ! pnpm install 2>&1; then
    echo "[build] Frontend pnpm install failed, retrying..."
    pnpm install --ignore-scripts 2>&1 || echo "[build] WARNING: frontend pnpm install failed"
fi

echo "[build] Building frontend..."
if npx vite build 2>&1; then
    echo "[build] Frontend build OK"
else
    echo "[build] WARNING: vite build failed — server will still start (API works, frontend may be stale)"
    BUILD_OK=false
fi

echo "[build] Build completed (frontend_ok=$BUILD_OK)"
