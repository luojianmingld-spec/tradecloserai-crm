/**
 * 老板微信通知服务 —— 「老板总裁助理」新询盘通知
 * 
 * 职责：CRM 后端向老板微信主动推送固定模板通知（不经过 LLM 推理）。
 * 通过 OpenClaw Gateway HTTP API 的 message 工具直推。
 * 
 * 环境变量：
 *   OPENCLAW_GATEWAY_URL   （默认 http://127.0.0.1:18789）
 *   OPENCLAW_GATEWAY_TOKEN （Gateway 鉴权 token，必填）
 *   BOSS_WECHAT_ACCOUNT    （OpenClaw 微信账号 ID，如 9f26fec14c44-im-bot）
 *   BOSS_WECHAT_ID         （老板微信会话 ID，如 xxx@im.wechat）
 */

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const BOSS_ACCOUNT = process.env.BOSS_WECHAT_ACCOUNT || '';
const BOSS_WECHAT_ID = process.env.BOSS_WECHAT_ID || '';

function truncate(text, n = 80) {
  if (!text) return '';
  const t = String(text);
  return t.length > n ? t.slice(0, n) + '…' : t;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatTime(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

/**
 * 发送一条微信通知给老板（固定文本直推，不经过 LLM）
 * @param {string} text 通知内容
 * @returns {Promise<boolean>} 是否发送成功
 */
export async function notifyBoss(text) {
  if (!GATEWAY_TOKEN || !BOSS_ACCOUNT || !BOSS_WECHAT_ID) {
    console.warn('[BossNotify] 缺少配置 OPENCLAW_GATEWAY_TOKEN / BOSS_WECHAT_ACCOUNT / BOSS_WECHAT_ID');
    return false;
  }
  if (!text || !text.trim()) return false;

  try {
    const resp = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        tool: 'message',
        args: {
          action: 'send',
          channel: 'openclaw-weixin',
          account: BOSS_ACCOUNT,
          to: BOSS_WECHAT_ID,
          text: String(text),
        },
      }),
    });
    if (!resp.ok) {
      console.warn(`[BossNotify] HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
      return false;
    }
    const data = await resp.json();
    const payload = typeof data?.result?.content?.[0]?.text === 'string'
      ? (() => { try { return JSON.parse(data.result.content[0].text); } catch { return data.result; } })()
      : (data?.result || {});
    const ok = !!data?.ok && (payload?.deliveryStatus === 'sent' || payload?.result?.messageId || data?.result?.deliveryStatus === 'sent');
    if (!ok) {
      console.warn('[BossNotify] 发送未确认:', JSON.stringify(data).slice(0, 300));
      return false;
    }
    console.log('[BossNotify] 已推送老板微信:', text.slice(0, 40));
    return true;
  } catch (err) {
    console.warn('[BossNotify] 推送失败:', err.message);
    return false;
  }
}

/**
 * 组装新询盘通知文本
 * @param {object} p { name, phone, body, ts }
 */
export function buildInquiryNotify(p) {
  const name = p?.name || p?.phone || '未知客户';
  const lines = [
    '【新询盘】📩',
    `👤 客户：${name}${p?.phone && p.phone !== name ? '（' + p.phone + '）' : ''}`,
    `💬 内容：${truncate(p?.body || '', 80)}`,
    `⏰ ${formatTime(p?.ts || new Date())}`,
    '💡 已自动建档，AI 正在跟进',
  ];
  return lines.join('\n');
}

export default { notifyBoss, buildInquiryNotify };
