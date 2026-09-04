/**
 * doc-archive.js - 单证存档 API（按客户/租户）
 *
 * 计费规则（2026-08-31 已拍板）：
 *   - 每个租户累计 100MB 免费存档空间（非每月重置）
 *   - 租户用量超出免费额度后，按 4积分/MB 扣费（不足1MB按1MB），从上传人积分余额扣
 *   - 删除文件释放空间，回到免费额度内
 *   - 上传前前端先调 /precheck 获取本次预计扣分，弹确认提示，明明白白
 *
 * 挂载：/api/doc-archive（authMiddleware 之后，路由内部不再重复鉴权）
 * 文件存储：backend/src/uploads/doc-archive/（物理落盘，永久保留，手动删除）
 * 下载：GET /api/doc-archive/download/:id（鉴权+归属校验，不开放匿名静态访问）
 */
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { getCreditBalance, deductCredits } from "../services/credits.js";

const router = Router();
const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── 计费参数 ──
export const FREE_QUOTA_MB = 100;        // 每租户累计免费额度（MB）
export const CREDIT_PER_MB = 4;          // 超出后单价（积分/MB）

const FREE_QUOTA_BYTES = FREE_QUOTA_MB * 1024 * 1024;
const UPLOAD_DIR = path.join(__dirname, "../uploads/doc-archive");

// 确保目录存在
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (e) { console.error("[DocArchive] mkdir error:", e.message); }

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 单证文件上限 50MB
});

// 取当前用户及其租户
async function getUserAndTenant(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, tenantId: true, username: true },
  });
  if (!user) throw new Error("用户不存在");
  return user;
}

// 统计租户当前已用字节（所有 DocArchive 文件大小总和）
async function getTenantUsageBytes(tenantId) {
  const agg = await prisma.docArchive.aggregate({
    where: { tenantId },
    _sum: { fileSize: true },
  });
  return agg._sum.fileSize || 0;
}

// 计算本次上传的预计扣分
// usedBytes 不含本次；sizeBytes 为本次文件大小
function calcCostCredits(usedBytes, sizeBytes) {
  if (usedBytes >= FREE_QUOTA_BYTES) {
    // 已超额度：全部按本次大小计费，不足1MB按1MB
    return Math.max(1, Math.ceil(sizeBytes / (1024 * 1024))) * CREDIT_PER_MB;
  }
  const after = usedBytes + sizeBytes;
  if (after <= FREE_QUOTA_BYTES) return 0; // 仍在免费额度内
  // 只对超出部分计费
  const overflowBytes = after - FREE_QUOTA_BYTES;
  return Math.max(1, Math.ceil(overflowBytes / (1024 * 1024))) * CREDIT_PER_MB;
}

/**
 * GET /api/doc-archive/usage
 * 返回：租户已用/免费额度/剩余免费/当前用户余额/单价
 */
router.get("/usage", async (req, res) => {
  try {
    const user = await getUserAndTenant(req.userId);
    const used = await getTenantUsageBytes(user.tenantId);
    const balance = await getCreditBalance(req.userId);
    const usedMB = Math.round((used / (1024 * 1024)) * 10) / 10;
    const freeMB = Math.round((FREE_QUOTA_MB - used / (1024 * 1024)) * 10) / 10;
    res.json({
      data: {
        freeQuotaMB: FREE_QUOTA_MB,
        usedMB,
        remainingFreeMB: Math.max(0, freeMB),
        overQuota: used >= FREE_QUOTA_BYTES,
        balance,
        creditPerMB: CREDIT_PER_MB,
      },
    });
  } catch (e) {
    console.error("[DocArchive] usage error:", e.message);
    res.status(500).json({ error: "获取用量失败" });
  }
});

/**
 * POST /api/doc-archive/precheck
 * body: { size }  本次待上传文件字节数
 * 返回：本次预计扣分 + 明细，供前端弹确认框
 */
router.post("/precheck", async (req, res) => {
  try {
    const sizeBytes = Number(req.body?.size);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return res.status(400).json({ error: "无效的文件大小" });
    }
    const user = await getUserAndTenant(req.userId);
    const used = await getTenantUsageBytes(user.tenantId);
    const cost = calcCostCredits(used, sizeBytes);
    const balance = await getCreditBalance(req.userId);
    const usedMB = Math.round((used / (1024 * 1024)) * 10) / 10;
    const sizeMB = Math.round((sizeBytes / (1024 * 1024)) * 10) / 10;
    res.json({
      data: {
        sizeBytes,
        sizeMB,
        usedMB,
        freeQuotaMB: FREE_QUOTA_MB,
        costCredits: cost,
        overQuota: used >= FREE_QUOTA_BYTES,
        balance,
        sufficient: balance >= cost,
      },
    });
  } catch (e) {
    console.error("[DocArchive] precheck error:", e.message);
    res.status(500).json({ error: "预检失败" });
  }
});

/**
 * POST /api/doc-archive/upload  (multipart/form-data: jid, platform, file)
 * 计费：先算租户已用，超出免费额度部分扣积分（不足1MB按1MB），余额不足则拒绝落盘
 */
router.post("/upload", upload.single("file"), async (req, res) => {
  let savedPath = null;
  try {
    const jid = String(req.body?.jid || "").trim();
    const platform = String(req.body?.platform || "whatsapp").trim();
    if (!jid) return res.status(400).json({ error: "缺少客户会话标识 jid" });
    if (!req.file) return res.status(400).json({ error: "未收到文件" });

    const user = await getUserAndTenant(req.userId);
    const tenantId = user.tenantId;

    // 1) 计算本次扣分
    const used = await getTenantUsageBytes(tenantId);
    const cost = calcCostCredits(used, req.file.size);

    // 2) 需要扣费时先扣积分（不足则抛错，不落盘）
    if (cost > 0) {
      await deductCredits(req.userId, cost, `单证存档超免费额度扣费（${tenantId}租户）`, {
        paymentMethod: "doc_archive",
      });
    }

    // 3) 落盘（租户子目录 + 哈希文件名，避免重名/路径注入）
    const safeTenant = String(tenantId);
    const tenantDir = path.join(UPLOAD_DIR, safeTenant);
    try { fs.mkdirSync(tenantDir, { recursive: true }); } catch (e) { /* ignore */ }
    const ext = path.extname(req.file.originalname || "").slice(0, 20);
    const hashName = Date.now() + "_" + crypto.randomBytes(6).toString("hex") + ext;
    savedPath = path.join(tenantDir, hashName);
    fs.writeFileSync(savedPath, req.file.buffer);

    // 4) 记录元数据
    const record = await prisma.docArchive.create({
      data: {
        tenantId,
        userId: req.userId,
        platform,
        jid,
        fileName: req.file.originalname || "unnamed",
        filePath: `/doc-archive/${safeTenant}/${hashName}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype || "application/octet-stream",
      },
    });

    const usedAfter = used + req.file.size;
    res.json({
      data: {
        id: record.id,
        fileName: record.fileName,
        fileSize: record.fileSize,
        createdAt: record.createdAt,
        costCredits: cost,
        usedMB: Math.round((usedAfter / (1024 * 1024)) * 10) / 10,
        freeQuotaMB: FREE_QUOTA_MB,
      },
    });
  } catch (e) {
    // 扣分失败或落盘失败：清理可能已写入的物理文件
    if (savedPath) { try { fs.unlinkSync(savedPath); } catch (e2) { /* ignore */ } }
    console.error("[DocArchive] upload error:", e.message, e.code || "");
    if (e.code === "INSUFFICIENT_CREDITS") {
      return res.status(402).json({ error: e.message, code: "INSUFFICIENT_CREDITS" });
    }
    res.status(500).json({ error: "上传失败：" + e.message });
  }
});

/**
 * GET /api/doc-archive/list?jid=xxx
 * 按客户列出单证（仅本租户可见）
 */
router.get("/list", async (req, res) => {
  try {
    const jid = String(req.query.jid || "").trim();
    if (!jid) return res.status(400).json({ error: "缺少 jid" });
    const user = await getUserAndTenant(req.userId);
    const list = await prisma.docArchive.findMany({
      where: { tenantId: user.tenantId, jid },
      orderBy: { createdAt: "desc" },
      select: { id: true, fileName: true, fileSize: true, mimeType: true, createdAt: true, userId: true, platform: true },
    });
    res.json({ data: list });
  } catch (e) {
    console.error("[DocArchive] list error:", e.message);
    res.status(500).json({ error: "获取单证列表失败" });
  }
});

/**
 * GET /api/doc-archive/download/:id
 * 鉴权 + 租户归属校验后返回文件
 */
router.get("/download/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "无效ID" });
    const user = await getUserAndTenant(req.userId);
    const rec = await prisma.docArchive.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!rec) return res.status(404).json({ error: "文件不存在" });

    // 校验物理文件存在
    const abs = path.join(UPLOAD_DIR, String(rec.tenantId), path.basename(rec.filePath));
    if (!fs.existsSync(abs)) return res.status(404).json({ error: "文件已被删除" });

    const encName = encodeURIComponent(rec.fileName);
    res.setHeader("Content-Type", rec.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="file"; filename*=UTF-8''${encName}`);
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    console.error("[DocArchive] download error:", e.message);
    res.status(500).json({ error: "下载失败" });
  }
});

/**
 * DELETE /api/doc-archive/:id
 * 删除单证（释放空间，回到免费额度内），仅限本租户
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "无效ID" });
    const user = await getUserAndTenant(req.userId);
    const rec = await prisma.docArchive.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!rec) return res.status(404).json({ error: "文件不存在" });

    // 删除物理文件
    const abs = path.join(UPLOAD_DIR, String(rec.tenantId), path.basename(rec.filePath));
    try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch (e) { /* ignore */ }

    await prisma.docArchive.delete({ where: { id } });
    const used = await getTenantUsageBytes(user.tenantId);
    res.json({
      data: {
        id,
        deleted: true,
        usedMB: Math.round((used / (1024 * 1024)) * 10) / 10,
        freeQuotaMB: FREE_QUOTA_MB,
      },
    });
  } catch (e) {
    console.error("[DocArchive] delete error:", e.message);
    res.status(500).json({ error: "删除失败" });
  }
});

export default router;
