/**
 * 共享上下文服务（6 Agent 共享上下文 Step1）
 * 借鉴 MyContext 三态合并机制，用自有架构实现：
 *  - 说法一致 → 加固置信度（+1，上限5）
 *  - LOCKED（人工确认过）→ 任何 Agent 不可覆盖
 *  - 真冲突 → 两条都保留标 CONFLICT，交人工裁决
 *  - 补充（不同 key）→ 各自独立存储，互不影响
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATUS = {
  ACTIVE: 'ACTIVE',
  CONFLICT: 'CONFLICT',
  LOCKED: 'LOCKED',
  SUPERSEDED: 'SUPERSEDED'
};

/**
 * 规范化 value 用于比较（去空白、小写）
 */
function normalizeValue(v) {
  return String(v || '').trim().toLowerCase();
}

/**
 * 核心：写入共享上下文，带三态合并
 * @param {object} data { entityType, entityId, key, value, sourceAgent, sourceRef, confidence }
 * @returns {Promise<{entry, action, conflict}>}
 *   action: 'created' | 'reinforced' | 'conflicted' | 'locked_blocked'
 */
export async function contextSet(data) {
  const entityType = String(data.entityType || 'customer').trim();
  const entityId = String(data.entityId || '').trim();
  const key = String(data.key || '').trim();
  const value = String(data.value || '').trim();
  if (!entityId || !key || !value) {
    return { error: true, message: 'entityId/key/value 均必填' };
  }

  // 查找该业务对象上同 key 的现有 ACTIVE/LOCKED/CONFLICT 结论
  const existing = await prisma.contextEntry.findFirst({
    where: {
      entityType,
      entityId,
      key,
      status: { in: [STATUS.ACTIVE, STATUS.LOCKED, STATUS.CONFLICT] }
    },
    orderBy: { id: 'asc' }
  });

  // 情况1：无已有结论 → 直接创建
  if (!existing) {
    const entry = await prisma.contextEntry.create({
      data: {
        entityType,
        entityId,
        key,
        value,
        confidence: Math.min(Math.max(parseInt(data.confidence, 10) || 3, 1), 5),
        status: STATUS.ACTIVE,
        sourceAgent: data.sourceAgent || null,
        sourceRef: data.sourceRef || null
      }
    });
    return { entry, action: 'created', conflict: null };
  }

  // 情况2：LOCKED（人工确认过）→ 永不覆盖
  if (existing.status === STATUS.LOCKED) {
    return {
      entry: existing,
      action: 'locked_blocked',
      conflict: null,
      message: `该结论已被人工锁定（${existing.value}），不允许覆盖。如需修改请在管理后台操作。`
    };
  }

  // 情况3：说法一致 → 加固置信度
  if (normalizeValue(existing.value) === normalizeValue(value)) {
    const newConfidence = Math.min((existing.confidence || 3) + 1, 5);
    const entry = await prisma.contextEntry.update({
      where: { id: existing.id },
      data: {
        confidence: newConfidence,
        updatedAt: new Date()
      }
    });
    return { entry, action: 'reinforced', conflict: null, message: `结论一致，置信度加固至 ${newConfidence}` };
  }

  // 情况4：真冲突（同 key 不同 value）→ 双标 CONFLICT，交人工裁决
  // 旧结论降置信度，新写入也标 CONFLICT 但保留，绝不静默覆盖
  const oldEntry = await prisma.contextEntry.update({
    where: { id: existing.id },
    data: {
      status: STATUS.CONFLICT,
      confidence: Math.max((existing.confidence || 3) - 1, 1),
      updatedAt: new Date()
    }
  });

  const newEntry = await prisma.contextEntry.create({
    data: {
      entityType,
      entityId,
      key,
      value,
      confidence: Math.min(Math.max(parseInt(data.confidence, 10) || 3, 1), 5),
      status: STATUS.CONFLICT,
      sourceAgent: data.sourceAgent || null,
      sourceRef: data.sourceRef || null
    }
  });

  // 记录冲突
  const conflict = await prisma.contextConflict.create({
    data: {
      entryIdA: oldEntry.id,
      entryIdB: newEntry.id
    }
  });

  return {
    entry: newEntry,
    oldEntry,
    action: 'conflicted',
    conflict,
    message: `检测到与已有结论冲突，双方已标记待人工裁决`
  };
}

/**
 * 读取共享上下文
 * @param {object} q { entityType, entityId, key?, status? }
 */
export async function contextGet(q) {
  const where = {};
  if (q.entityType) where.entityType = String(q.entityType).trim();
  if (q.entityId) where.entityId = String(q.entityId).trim();
  if (q.key) where.key = String(q.key).trim();
  if (q.status) where.status = String(q.status).trim();

  const entries = await prisma.contextEntry.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 50
  });

  // 按 status 排序：LOCKED 优先，再 ACTIVE，再 CONFLICT
  const order = { LOCKED: 0, ACTIVE: 1, CONFLICT: 2, SUPERSEDED: 3 };
  entries.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  return {
    entries: entries.map(e => ({
      id: e.id,
      entityType: e.entityType,
      entityId: e.entityId,
      key: e.key,
      value: e.value,
      confidence: e.confidence,
      status: e.status,
      sourceAgent: e.sourceAgent,
      sourceRef: e.sourceRef,
      recordedAt: e.recordedAt,
      updatedAt: e.updatedAt
    }))
  };
}

/**
 * 获取待裁决冲突列表（管理后台）
 */
export async function listConflicts() {
  const conflicts = await prisma.contextConflict.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  const entryIds = [];
  for (const c of conflicts) {
    entryIds.push(c.entryIdA, c.entryIdB);
  }

  const entries = await prisma.contextEntry.findMany({
    where: { id: { in: entryIds } }
  });
  const entryMap = {};
  for (const e of entries) entryMap[e.id] = e;

  return conflicts.map(c => ({
    id: c.id,
    entryA: entryMap[c.entryIdA] || null,
    entryB: entryMap[c.entryIdB] || null,
    resolvedBy: c.resolvedBy,
    resolution: c.resolution,
    resolvedAt: c.resolvedAt,
    createdAt: c.createdAt
  }));
}

/**
 * 人工裁决：pick_a / pick_b / merge / both_keep
 * 裁决后：被选中的标 LOCKED，另一条标 SUPERSEDED
 */
export async function resolveConflict(conflictId, resolution, resolvedBy = 'human') {
  const conflict = await prisma.contextConflict.findUnique({
    where: { id: parseInt(conflictId, 10) }
  });
  if (!conflict) return { error: true, message: '冲突记录不存在' };
  if (conflict.resolvedAt) return { error: true, message: '该冲突已裁决' };

  const a = await prisma.contextEntry.findUnique({ where: { id: conflict.entryIdA } });
  const b = await prisma.contextEntry.findUnique({ where: { id: conflict.entryIdB } });
  if (!a || !b) return { error: true, message: '冲突条目不存在' };

  let winnerId = null;
  switch (resolution) {
    case 'pick_a': winnerId = a.id; break;
    case 'pick_b': winnerId = b.id; break;
    case 'merge': {
      // 合并：以 A 为准 + B 附注，A 保持 LOCKED，B SUPERSEDED
      winnerId = a.id;
      await prisma.contextEntry.update({
        where: { id: a.id },
        data: { status: STATUS.LOCKED, value: `${a.value}（合并补充：${b.value}）`, updatedAt: new Date() }
      });
      await prisma.contextEntry.update({
        where: { id: b.id },
        data: { status: STATUS.SUPERSEDED, updatedAt: new Date() }
      });
      break;
    }
    case 'both_keep': {
      // 双保留：各自保留为独立结论（不同侧面），都转 LOCKED
      await prisma.contextEntry.update({
        where: { id: a.id },
        data: { status: STATUS.LOCKED, updatedAt: new Date() }
      });
      await prisma.contextEntry.update({
        where: { id: b.id },
        data: { status: STATUS.LOCKED, updatedAt: new Date() }
      });
      break;
    }
    default:
      return { error: true, message: '无效的裁决方式' };
  }

  if (winnerId && resolution !== 'merge' && resolution !== 'both_keep') {
    await prisma.contextEntry.update({
      where: { id: winnerId },
      data: { status: STATUS.LOCKED, updatedAt: new Date() }
    });
    const loserId = winnerId === a.id ? b.id : a.id;
    await prisma.contextEntry.update({
      where: { id: loserId },
      data: { status: STATUS.SUPERSEDED, updatedAt: new Date() }
    });
  }

  await prisma.contextConflict.update({
    where: { id: conflict.id },
    data: { resolvedBy, resolution, resolvedAt: new Date() }
  });

  return { success: true, resolution, message: '裁决完成，已锁定选中结论' };
}

/**
 * 初始化/更新 AgentProfile
 */
export async function upsertAgentProfile(agentType, profileJson, playbookJson = null) {
  return prisma.agentProfile.upsert({
    where: { agentType },
    update: { profileJson, playbookJson: playbookJson || undefined, updatedAt: new Date() },
    create: { agentType, profileJson, playbookJson: playbookJson || undefined }
  });
}

/**
 * 读取 AgentProfile
 */
export async function getAgentProfile(agentType) {
  return prisma.agentProfile.findUnique({ where: { agentType } });
}
