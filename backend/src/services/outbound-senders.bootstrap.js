/**
 * Outbound Draft Senders Bootstrap
 * ============================================================================
 * 在 server 启动时向 outbound-draft 服务注册「真实通道发送器」与「dryRun 模拟发送器」。
 * - 真实发送器只在确认（confirm）阶段被调用；LLM 工具侧永远只生成草稿。
 * - dryRun 走模拟通道，可按 target 注入失败用于验收，绝不触达真实客户。
 */
import { registerSenders } from './outbound-draft.service.js';
import { getEvolutionConnector } from './evolution-connector.js';
import { sendEmail } from './email.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function setupOutboundSenders(io, opts = {}) {
  registerSenders({
    // dryRun 发送器（键名与服务内 senderKey='__dryrun__' 对齐）：模拟成功/失败
    __dryrun__: {
      send: async (draft) => {
        // 允许通过 target 关键字注入失败，便于验收「发送失败不被标记为成功」
        if (/fail|error|502/i.test(draft.target || '')) {
          return { ok: false, error: 'DRYRUN_INJECTED_FAILURE' };
        }
        return {
          ok: true,
          dryRun: true,
          messageId: `dryrun-${draft.id}`,
        };
      },
    },

    // 真实 WhatsApp 发送器（复用手动发送同款连接器，避免重复路径）
    whatsapp: {
      send: async (draft) => {
        const instanceName = draft.senderInstance;
        if (!instanceName) {
          return { ok: false, error: 'NO_SENDER' };
        }
        const conn = getEvolutionConnector(instanceName);
        const jid = draft.target.includes('@') ? draft.target : `${draft.target}@s.whatsapp.net`;
        const result = await conn.sendTextMessage(jid, draft.content);

        // 落 WAMessage 出站记录（字段对齐真实 schema；sessionId 用实例名）
        const waId = result?.key?.id || result?.id || result?.key.id || null;
        try {
          const saved = await prisma.wAMessage.create({
            data: {
              sessionId: instanceName,
              from: instanceName,
              to: jid,
              body: draft.content,
              type: 'text',
              direction: 'outbound',
              timestamp: new Date(),
              waMessageId: waId,
              waKeyJson: result ? JSON.stringify(result.key || result) : null,
            },
          });
          // 触发前端会话更新（与现有出站消息同一事件）
          if (io) {
            io.to(`user_${draft.userId}`).emit('message:outbound', { id: saved.id, jid, customerId: draft.customerId });
          }
        } catch (logErr) {
          // 记录失败不影响「已实际发出」的事实；只告警
          console.error('[Outbound] persist WA message failed (already sent):', logErr.message);
        }

        return { ok: true, messageId: waId };
      },
    },

    // 真实 Email 发送器
    email: {
      send: async (draft) => {
        // 服务端重新校验邮件账号归属，防止用户确认时引用了他人账号
        const accountId = draft.emailAccountId
          ? Number(draft.emailAccountId)
          : await getDefaultEmailAccountId(draft.userId);
        if (!accountId) {
          return { ok: false, error: 'NO_SENDER' };
        }
        const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
        if (!account || account.userId !== draft.userId) {
          return { ok: false, error: 'FORBIDDEN' };
        }
        const saved = await sendEmail(accountId, {
          to: draft.target,
          subject: draft.subject || '',
          body: draft.content,
          html: draft.content,
        });
        return { ok: true, messageId: saved?.id ? String(saved.id) : null };
      },
    },
  });
}

async function getDefaultEmailAccountId(userId) {
  const acc = await prisma.emailAccount.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return acc?.id || null;
}

export default setupOutboundSenders;
