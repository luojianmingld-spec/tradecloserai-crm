/**
 * Reminder Scheduler - 定时检查并触发日程提醒
 * 功能：
 *  - 每 30 秒检查一次到期（remindAt <= now && status=pending）的提醒
 *  - 到期后：
 *    1. 标记 status=fired + firedAt
 *    2. 写入 assistantConversation（该 agent 会话历史可见，前端打开即见）
 *    3. 若指定了 jid（客户），通过 Evolution 发送 WhatsApp 提醒
 *    4. 通过 socket.io 推送 reminder:fired 事件（前端可实时弹提示）
 * 说明：UTC 存储/比较；自然语言时间在 create 时已由 assistant.service 转成 UTC。
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let timer = null;
let running = false;

export function startReminderScheduler(io) {
  if (timer) {
    console.log('[Reminder Scheduler] Already running');
    return;
  }

  const CHECK_INTERVAL = 30 * 1000; // 30 秒

  console.log('[Reminder Scheduler] Starting...');

  // 启动后延迟 10 秒先跑一次，等服务完全就绪
  setTimeout(() => {
    runCheck(io).catch(err => console.error('[Reminder Scheduler] Initial check error:', err));
  }, 10 * 1000);

  timer = setInterval(() => {
    runCheck(io).catch(err => console.error('[Reminder Scheduler] Check error:', err));
  }, CHECK_INTERVAL);

  console.log(`[Reminder Scheduler] Started, checking every ${CHECK_INTERVAL / 1000}s`);
}

export function stopReminderScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[Reminder Scheduler] Stopped');
  }
}

async function runCheck(io) {
  if (running) return; // 防重入
  running = true;
  try {
    const now = new Date();
    const due = await prisma.reminder.findMany({
      where: {
        status: 'pending',
        remindAt: { lte: now }
      },
      take: 50,
      orderBy: { remindAt: 'asc' }
    });

    if (due.length === 0) return;

    for (const r of due) {
      try {
        // 1. 标记已触发
        await prisma.reminder.update({
          where: { id: r.id },
          data: { status: 'fired', firedAt: now }
        });

        const title = r.title || '日程提醒';
        const content = r.content || '';

        // 2. 写入 assistantConversation，让该 agent 会话历史可见
        await prisma.assistantConversation.create({
          data: {
            userId: r.userId,
            agentType: r.agentType || 'general',
            role: 'assistant',
            content: `⏰ 提醒到点：${title}\n${content}`,
            ...(r.sessionId ? { sessionId: r.sessionId } : {})
          }
        }).catch(e => console.error('[Reminder Scheduler] conversation write error:', e.message));

        // 3. 若指定了客户 jid，发送 WhatsApp 提醒（operator 主动要求触发的合规外呼）
        if (r.jid) {
          try {
            const { default: evolutionConnector } = await import('./evolution-connector.js');
            const jid = r.jid.includes('@') ? r.jid : `${r.jid}@s.whatsapp.net`;
            await evolutionConnector.sendTextMessage(jid, `⏰ 提醒：${title}\n${content}`);
          } catch (e) {
            console.error('[Reminder Scheduler] WA send error for reminder ' + r.id + ':', e.message);
          }
        }

        // 4. socket 推送（前端可实时提示）
        if (io && typeof io.emit === 'function') {
          io.emit('reminder:fired', {
            id: r.id,
            userId: r.userId,
            agentType: r.agentType,
            title,
            content,
            remindAt: r.remindAt,
            firedAt: now
          });
        }

        console.log(`[Reminder Scheduler] Fired reminder #${r.id} (${r.agentType}): ${title} @ ${now.toISOString()}`);
      } catch (e) {
        console.error('[Reminder Scheduler] Fire error for reminder ' + r.id + ':', e.message);
      }
    }
  } finally {
    running = false;
  }
}

export default { startReminderScheduler, stopReminderScheduler };
