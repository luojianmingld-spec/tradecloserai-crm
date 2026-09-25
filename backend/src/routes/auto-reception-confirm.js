/**
 * Auto Reception 待销售确认 —— 免登录 H5 确认页 + 确认接口
 * GET  /auto-reception/confirm/:token  渲染移动端确认页（一次性 token，60分钟)
 * POST /auto-reception/confirm/:token  body:{action:'send'|'edit'|'reject', text?}
 */
import { Router } from 'express';
import AutoReceptionService from '../services/auto-reception.service.js';
const { confirmAndSend, getPendingDraft } = AutoReceptionService;

const router = Router();

const PAGE = (draft, token) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>销冠待确认</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f2f4f7; padding: 16px; color: #1f2329; }
  .card { background: #fff; border-radius: 12px; padding: 18px 16px; margin-bottom: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
  .card h3 { font-size: 13px; color: #8a8f99; font-weight: 500; margin-bottom: 8px; }
  .card .body { font-size: 15px; line-height: 1.6; word-break: break-word; white-space: pre-wrap; }
  .tag { display: inline-block; background: #fff4e5; color: #b25e09; font-size: 12px; padding: 2px 8px; border-radius: 4px; margin-bottom: 6px; }
  textarea { width: 100%; min-height: 96px; border: 1px solid #dcdfe6; border-radius: 8px; padding: 10px; font-size: 15px; font-family: inherit; line-height: 1.6; resize: vertical; }
  .btn { display: block; width: 100%; padding: 14px; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 10px; }
  .btn.primary { background: #2f6fed; color: #fff; }
  .btn.danger { background: #fff; color: #d54941; border: 1px solid #e5e6eb; margin-top: 8px; }
  .hint { font-size: 12px; color: #8a8f99; text-align: center; margin-top: 12px; }
  .ok-box { text-align: center; padding: 40px 20px; }
  .ok-box .icon { font-size: 48px; margin-bottom: 12px; }
  .ok-box h2 { font-size: 18px; margin-bottom: 8px; }
  .ok-box p { font-size: 14px; color: #646a73; line-height: 1.6; }
</style>
</head>
<body>
  <div id="app"></div>
<script>
const token = ${JSON.stringify(token)};
const draft = ${JSON.stringify(draft || null)};
const app = document.getElementById('app');
if (!draft) {
  app.innerHTML = '<div class="ok-box"><div class="icon">⚠️</div><h2>链接无效</h2><p>确认链接不存在或已失效，可能已被处理或过期。<br>请让销冠重新生成，或直接登录系统人工回复。</p></div>';
} else if (draft.status === 'expired') {
  app.innerHTML = '<div class="ok-box"><div class="icon">⏰</div><h2>链接已过期</h2><p>该确认已超过60分钟失效。<br>请直接登录系统人工回复该客户。</p></div>';
} else {
  app.innerHTML = \`
    <div class="card">
      <h3>客户</h3>
      <div class="body">\${draft.pushName || '未知'}（\${draft.remoteJid || ''}）</div>
    </div>
    <div class="card">
      <h3>客户消息</h3>
      <div class="body">\${escapeHtml(draft.body || '')}</div>
    </div>
    <div class="card">
      <h3>销冠拟回复</h3>
      <span class="tag">\${escapeHtml(draft.reason || '需把关')}</span>
      <textarea id="replyText">\${escapeHtml(draft.sendText || draft.replyZh || '')}</textarea>
    </div>
    <button class="btn primary" id="btnSend">✅ 确认发送给客户</button>
    <button class="btn danger" id="btnReject">🚫 拒发，转人工处理</button>
    <div class="hint">确认后销冠才会把这条话术发给客户；可先修改再发送</div>
  \`;
  const setBusy = (busy) => { document.getElementById('btnSend').disabled = busy; document.getElementById('btnReject').disabled = busy; };
  const showResult = (msg, ok) => { app.innerHTML = '<div class="ok-box"><div class="icon">' + (ok ? '✅' : '❌') + '</div><h2>' + (ok ? '处理成功' : '处理失败') + '</h2><p>' + escapeHtml(msg) + '</p></div>'; };
  document.getElementById('btnSend').onclick = async () => {
    const text = document.getElementById('replyText').value.trim();
    const action = text === (draft.sendText || draft.replyZh || '').trim() ? 'send' : 'edit';
    setBusy(true);
    try {
      const r = await fetch('/auto-reception/confirm/' + token, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, text }),
      });
      const d = await r.json();
      showResult(d.message || '已处理', !!d.sent);
    } catch (e) { showResult('网络异常，请重试', false); }
  };
  document.getElementById('btnReject').onclick = async () => {
    setBusy(true);
    try {
      const r = await fetch('/auto-reception/confirm/' + token, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      const d = await r.json();
      showResult(d.message || '已拒发', !!d.rejected);
    } catch (e) { showResult('网络异常，请重试', false); }
  };
}
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
</script>
</body>
</html>`;

// GET 确认页
router.get('/confirm/:token', (req, res) => {
  const token = String(req.params.token || '');
  const draft = getPendingDraft(token);
  res.type('html').send(PAGE(draft, token));
});

// POST 确认动作
router.post('/confirm/:token', async (req, res) => {
  const token = String(req.params.token || '');
  const { action, text } = req.body || {};
  try {
    const result = await confirmAndSend(token, {
      action: action === 'reject' ? 'reject' : (action === 'edit' ? 'edit' : 'send'),
      text,
    });
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'INTERNAL', message: '处理失败，请重试' });
  }
});

export default router;