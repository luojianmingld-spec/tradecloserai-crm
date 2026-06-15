#!/bin/bash
# Dev startup script - launches backend and frontend reliably
# No dependency on concurrently

PROJECT_DIR="/workspace/projects"

echo "[start-dev] Starting WhatsApp CRM dev environment..."

# ─── Start Backend ───
cd "$PROJECT_DIR/backend"
PORT=3001 node src/server.js >> /app/work/logs/bypass/app.log 2>&1 &
BACKEND_PID=$!
echo "[start-dev] Backend started (PID: $BACKEND_PID, port: 3001)"

# Wait for backend to be ready (max 10s)
for i in $(seq 1 10); do
  if curl -s --max-time 1 http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "[start-dev] Backend is ready"
    break
  fi
  sleep 1
done

# ─── Start Frontend ───
cd "$PROJECT_DIR/frontend"
npx vite --port ${DEPLOY_RUN_PORT:-5000} --host 0.0.0.0 >> /app/work/logs/bypass/dev.log 2>&1 &
FRONTEND_PID=$!
echo "[start-dev] Frontend started (PID: $FRONTEND_PID, port: ${DEPLOY_RUN_PORT:-5000})"

# Wait for frontend to be ready (max 10s)
for i in $(seq 1 10); do
  if curl -s --max-time 1 http://localhost:${DEPLOY_RUN_PORT:-5000}/ > /dev/null 2>&1; then
    echo "[start-dev] Frontend is ready"
    break
  fi
  sleep 1
done

echo "[start-dev] Both services running. Waiting for processes..."

# Monitor both processes - if either dies, log it but keep going
while true; do
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[start-dev] WARNING: Backend process died! Restarting..."
    cd "$PROJECT_DIR/backend"
    PORT=3001 node src/server.js >> /app/work/logs/bypass/app.log 2>&1 &
    BACKEND_PID=$!
    echo "[start-dev] Backend restarted (PID: $BACKEND_PID)"
  fi
  
  if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "[start-dev] WARNING: Frontend process died! Restarting..."
    cd "$PROJECT_DIR/frontend"
    npx vite --port ${DEPLOY_RUN_PORT:-5000} --host 0.0.0.0 >> /app/work/logs/bypass/dev.log 2>&1 &
    FRONTEND_PID=$!
    echo "[start-dev] Frontend restarted (PID: $FRONTEND_PID)"
  fi
  
  sleep 5
done
