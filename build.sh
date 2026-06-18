#!/bin/bash
set -e

echo "[build] Starting build process..."

# Resolve workspace path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$SCRIPT_DIR}"

echo "[build] COZE_WORKSPACE_PATH=${COZE_WORKSPACE_PATH}"

# ========== Backend ==========
echo "[build] Installing backend dependencies..."
cd "$COZE_WORKSPACE_PATH/backend"

# Install all dependencies (Baileys is optionalDependency, won't block build if it fails)
pnpm install 2>&1 || {
    echo "[build] pnpm install failed, retrying with --ignore-scripts..."
    pnpm install --ignore-scripts 2>&1 || true
}

# Generate Prisma client
echo "[build] Generating Prisma client..."
npx prisma generate 2>&1 || echo "[build] WARNING: prisma generate failed"

# Push database schema
echo "[build] Pushing database schema..."
npx prisma db push 2>&1 || echo "[build] WARNING: prisma db push failed"

# Create sessions directory for WhatsApp
mkdir -p "$COZE_WORKSPACE_PATH/backend/sessions"

# ========== Frontend ==========
echo "[build] Installing frontend dependencies..."
cd "$COZE_WORKSPACE_PATH/frontend"
pnpm install 2>&1 || {
    echo "[build] Frontend pnpm install failed, retrying..."
    pnpm install --ignore-scripts 2>&1 || true
}

echo "[build] Building frontend..."
npx vite build 2>&1

echo "[build] Build completed successfully!"
