#!/usr/bin/env bash
# ============================================================================
# SQLite → PostgreSQL 多租户迁移部署脚本
# 用法: bash deploy-migration.sh [--skip-backup] [--skip-migrate]
# 前提: 将 multi-tenant-schema.prisma 和 migrate-data.js 放到
#        /opt/whatsapp-crm-staging/backend/ 目录下
# ============================================================================

set -euo pipefail

# ─── 配置 ────────────────────────────────────────────────────────────────────
APP_DIR="/opt/whatsapp-crm-staging/backend"
PRISMA_DIR="${APP_DIR}/prisma"
SQLITE_DB="${PRISMA_DIR}/crm-staging.db"
BACKUP_DIR="${APP_DIR}/backups"
NEW_SCHEMA="multi-tenant-schema.prisma"
MIGRATE_SCRIPT="migrate-data.js"
PG_URL='postgresql://crm_app:Crm2026pg!@localhost:5432/crm_staging'
SERVICE_NAME="whatsapp-crm-staging"
HEALTH_URL="http://localhost:3003/api/health"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── 参数解析 ────────────────────────────────────────────────────────────────
SKIP_BACKUP=false
SKIP_MIGRATE=false

for arg in "$@"; do
  case $arg in
    --skip-backup) SKIP_BACKUP=true ;;
    --skip-migrate) SKIP_MIGRATE=true ;;
    --help|-h)
      echo "用法: bash deploy-migration.sh [--skip-backup] [--skip-migrate]"
      echo ""
      echo "  --skip-backup   跳过 SQLite 备份"
      echo "  --skip-migrate  跳过数据迁移（仅更新 schema 和配置）"
      exit 0
      ;;
  esac
done

# ─── 辅助函数 ────────────────────────────────────────────────────────────────
step() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

ok()   { echo -e "  ${GREEN}✅ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; exit 1; }

# ─── 前置检查 ────────────────────────────────────────────────────────────────
step "1/8 前置检查"

# 检查目录
if [ ! -d "${APP_DIR}" ]; then
  fail "应用目录不存在: ${APP_DIR}"
fi
ok "应用目录: ${APP_DIR}"

# 检查新 schema 文件
if [ ! -f "${APP_DIR}/${NEW_SCHEMA}" ]; then
  fail "新 schema 文件不存在: ${APP_DIR}/${NEW_SCHEMA}\n  请先将 ${NEW_SCHEMA} scp 到 ${APP_DIR}/"
fi
ok "新 schema 文件已就位"

# 检查迁移脚本
if [ ! -f "${APP_DIR}/${MIGRATE_SCRIPT}" ]; then
  fail "迁移脚本不存在: ${APP_DIR}/${MIGRATE_SCRIPT}\n  请先将 ${MIGRATE_SCRIPT} scp 到 ${APP_DIR}/"
fi
ok "迁移脚本已就位"

# 检查 PostgreSQL 连接
if ! psql "${PG_URL}" -c "SELECT 1" > /dev/null 2>&1; then
  fail "PostgreSQL 连接失败: ${PG_URL}"
fi
ok "PostgreSQL 连接正常"

# 检查 Node.js
if ! command -v node &> /dev/null; then
  fail "Node.js 未安装"
fi
ok "Node.js $(node -v)"

# ─── 备份 SQLite ─────────────────────────────────────────────────────────────
step "2/8 备份 SQLite 数据库"

if [ "$SKIP_BACKUP" = true ]; then
  warn "已跳过备份 (--skip-backup)"
else
  mkdir -p "${BACKUP_DIR}"

  if [ -f "${SQLITE_DB}" ]; then
    BACKUP_FILE="${BACKUP_DIR}/crm-staging_${TIMESTAMP}.db"
    cp "${SQLITE_DB}" "${BACKUP_FILE}"
    ok "SQLite 已备份: ${BACKUP_FILE}"
    ok "备份大小: $(du -h "${BACKUP_FILE}" | cut -f1)"
  else
    warn "SQLite 数据库不存在: ${SQLITE_DB}，跳过备份"
  fi
fi

# ─── 停止服务 ────────────────────────────────────────────────────────────────
step "3/8 停止 staging 服务"

if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
  systemctl stop "${SERVICE_NAME}"
  ok "服务已停止"
else
  warn "服务未运行或不存在"
fi

# ─── 更新 Prisma Schema ─────────────────────────────────────────────────────
step "4/8 更新 Prisma Schema"

# 备份当前 schema
cp "${PRISMA_DIR}/schema.prisma" "${PRISMA_DIR}/schema.prisma.bak.${TIMESTAMP}"
ok "当前 schema 已备份: schema.prisma.bak.${TIMESTAMP}"

# 复制新 schema
cp "${APP_DIR}/${NEW_SCHEMA}" "${PRISMA_DIR}/schema.prisma"
ok "新 schema 已复制到 ${PRISMA_DIR}/schema.prisma"

# 验证 schema 内容
if grep -q 'provider = "postgresql"' "${PRISMA_DIR}/schema.prisma"; then
  ok "schema provider 已确认为 postgresql"
else
  fail "schema provider 不是 postgresql，请检查文件内容"
fi

if grep -q 'model Tenant' "${PRISMA_DIR}/schema.prisma"; then
  ok "Tenant 模型已确认存在"
else
  fail "Tenant 模型不存在，请检查文件内容"
fi

# ─── Prisma Generate & DB Push ───────────────────────────────────────────────
step "5/8 同步数据库 Schema (Prisma)"

cd "${APP_DIR}"

echo "  运行 npx prisma generate..."
npx prisma generate
ok "Prisma Client 已生成"

echo "  运行 npx prisma db push..."
npx prisma db push --accept-data-loss
ok "数据库 Schema 已同步到 PostgreSQL"

# ─── 数据迁移 ────────────────────────────────────────────────────────────────
step "6/8 执行数据迁移"

if [ "$SKIP_MIGRATE" = true ]; then
  warn "已跳过数据迁移 (--skip-migrate)"
else
  # 安装 better-sqlite3（如果未安装）
  if ! node -e "require('better-sqlite3')" 2>/dev/null; then
    echo "  安装 better-sqlite3..."
    npm install --no-save better-sqlite3 2>&1 | tail -1
    ok "better-sqlite3 已安装"
  else
    ok "better-sqlite3 已就绪"
  fi

  # 运行迁移脚本
  echo "  执行迁移脚本..."
  DATABASE_URL="${PG_URL}" node "${APP_DIR}/${MIGRATE_SCRIPT}" --sqlite "${SQLITE_DB}"
  ok "数据迁移脚本执行完成"
fi

# ─── 更新 .env ───────────────────────────────────────────────────────────────
step "7/8 更新环境配置"

ENV_FILE="${APP_DIR}/.env"

# 备份 .env
cp "${ENV_FILE}" "${ENV_FILE}.bak.${TIMESTAMP}"
ok ".env 已备份"

# 更新 DATABASE_URL
if grep -q '^DATABASE_URL=' "${ENV_FILE}"; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${PG_URL}|" "${ENV_FILE}"
  ok "DATABASE_URL 已更新为 PostgreSQL"
else
  echo "DATABASE_URL=${PG_URL}" >> "${ENV_FILE}"
  ok "DATABASE_URL 已添加"
fi

# 同步更新 systemd 服务的环境变量
SYSTEMD_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
if [ -f "${SYSTEMD_FILE}" ]; then
  sed -i "s|Environment=DATABASE_URL=.*|Environment=DATABASE_URL=${PG_URL}|" "${SYSTEMD_FILE}"
  systemctl daemon-reload
  ok "systemd 服务配置已更新并 reload"
fi

# ─── 启动服务 & 健康检查 ─────────────────────────────────────────────────────
step "8/8 启动服务 & 健康检查"

systemctl start "${SERVICE_NAME}"
ok "服务已启动"

# 等待服务就绪
echo "  等待服务启动..."
HEALTH_OK=false
HEALTH_ENDPOINTS=("${HEALTH_URL}" "http://localhost:3003/health" "http://localhost:3003/")
for i in $(seq 1 30); do
  for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
    if curl -sf "${endpoint}" > /dev/null 2>&1; then
      ok "服务健康检查通过 (${endpoint})"
      HEALTH_OK=true
      break 2
    fi
  done
  sleep 2
done

if [ "$HEALTH_OK" = false ]; then
  warn "健康检查超时，请手动验证服务状态"
  echo "  尝试: curl http://localhost:3003/"
  echo "  最近日志:"
  journalctl -u "${SERVICE_NAME}" -n 30 --no-pager 2>/dev/null || tail -30 "${APP_DIR}/staging.log" 2>/dev/null
fi

# ─── 完成 ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉 迁移部署完成！                                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  📋 后续事项:"
echo "     1. 验证应用功能正常"
echo "     2. 确认数据完整性"
echo "     3. 确认稳定后可删除旧 SQLite 文件和 backup 目录"
echo "     4. 更新应用代码中的查询，添加 tenantId 过滤"
echo ""
echo "  🔄 回滚方法:"
echo "     1. systemctl stop ${SERVICE_NAME}"
echo "     2. cp ${PRISMA_DIR}/schema.prisma.bak.${TIMESTAMP} ${PRISMA_DIR}/schema.prisma"
echo "     3. cp ${ENV_FILE}.bak.${TIMESTAMP} ${ENV_FILE}"
echo "     4. npx prisma generate && npx prisma db push"
echo "     5. systemctl start ${SERVICE_NAME}"
echo ""
