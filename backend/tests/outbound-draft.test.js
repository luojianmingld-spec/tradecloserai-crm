/**
 * Outbound Draft 安全门自动化验收测试（TC-SEC-002）
 * ============================================================================
 * 运行：node --test
 * - 使用临时工作目录（process.chdir 到 tmp），与线上数据完全隔离。
 * - 全部外发走注入的 mock 发送器，绝不触达真实客户。
 * - 双虚拟租户：TENANT_A=9001 / TENANT_B=9002。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createDraft,
  getDraft,
  listDrafts,
  rejectDraft,
  confirmAndSendDraft,
  registerSenders,
  isOutboundGateEnabled,
  isAgentDirectAllowed,
  _internals,
} from '../src/services/outbound-draft.service.js';

const TENANT_A = 9001;
const TENANT_B = 9002;

let callLog = [];

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outbound-test-'));
  process.chdir(dir);
  callLog = [];
  registerSenders({
    __dryrun__: {
      send: async (draft) => {
        callLog.push(draft.id);
        if (/fail|error|502/i.test(draft.target || '')) return { ok: false, error: 'INJECTED_FAIL' };
        return { ok: true, messageId: `dry-${draft.id}` };
      },
    },
    whatsapp: {
      send: async (draft) => {
        callLog.push(draft.id);
        if (/fail|error|502/i.test(draft.target || '')) return { ok: false, error: 'INJECTED_FAIL' };
        return { ok: true, messageId: `wa-${draft.id}` };
      },
    },
    email: {
      send: async (draft) => {
        callLog.push(draft.id);
        return { ok: true, messageId: `em-${draft.id}` };
      },
    },
  });
  return dir;
}

test.beforeEach(() => setup());

test('fail-secure 默认：安全门启用、直发默认禁止', () => {
  assert.equal(isOutboundGateEnabled(), true);
  assert.equal(isAgentDirectAllowed(), false);
});

test('验收1: 创建草稿后状态为 pending，不触发任何发送', async () => {
  const d = await createDraft({
    userId: TENANT_A, channel: 'whatsapp', target: '15550001@c.us',
    content: 'hello from agent', senderInstance: 'instA', customerId: 1,
  });
  assert.equal(d.status, 'pending');
  assert.equal(callLog.length, 0); // 未发送
  const loaded = getDraft(d.id);
  assert.equal(loaded.status, 'pending');
  assert.equal(loaded.userId, TENANT_A);
});

test('验收3: 归属用户确认后成功发送（dryRun）并落 sent', async () => {
  const d = await createDraft({
    userId: TENANT_A, channel: 'whatsapp', target: '15550001@c.us',
    content: 'confirm me', senderInstance: 'instA',
  });
  const r = await confirmAndSendDraft(d.id, { userId: TENANT_A }, { dryRun: true }, { ip: '127.0.0.1' });
  assert.equal(r.ok, true);
  assert.equal(r.status, 'sent');
  assert.equal(callLog.length, 1);
  assert.equal(getDraft(d.id).status, 'sent');
});

test('验收4: B 租户不能确认 A 租户草稿（FORBIDDEN，且不发送）', async () => {
  const d = await createDraft({
    userId: TENANT_A, channel: 'whatsapp', target: '15550001@c.us',
    content: 'secret', senderInstance: 'instA',
  });
  const r = await confirmAndSendDraft(d.id, { userId: TENANT_B }, { dryRun: true });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'FORBIDDEN');
  assert.equal(callLog.length, 0);
  assert.equal(getDraft(d.id).status, 'pending');
});

test('验收4b: B 租户不能拒发 A 租户草稿', async () => {
  const d = await createDraft({
    userId: TENANT_A, channel: 'email', target: 'b@x.com',
    content: 'mail body', extra: { subject: 's', emailAccountId: 5 },
  });
  const r = await rejectDraft(d.id, { userId: TENANT_B });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'FORBIDDEN');
  assert.equal(getDraft(d.id).status, 'pending');
});

test('验收5: 重复/并发确认只发送一次（幂等）', async () => {
  const d = await createDraft({
    userId: TENANT_A, channel: 'whatsapp', target: '15550001@c.us',
    content: 'spam guard', senderInstance: 'instA',
  });
  const [r1, r2, r3] = await Promise.all([
    confirmAndSendDraft(d.id, { userId: TENANT_A }, { dryRun: true }),
    confirmAndSendDraft(d.id, { userId: TENANT_A }, { dryRun: true }),
    confirmAndSendDraft(d.id, { userId: TENANT_A }, { dryRun: true }),
  ]);
  assert.equal(r1.ok, true);
  // 后两次至少一次应为 duplicate；关键断言是真实发送仅一次
  assert.equal(callLog.length, 1);
  assert.ok(r2.ok && r3.ok, '并发确认应安全返回成功而非报错');
  assert.ok(r2.duplicate || r3.duplicate || r1.duplicate, '应有一次被识别为重复');
});

test('验收6: 发送失败不标记为成功（FAILED，可重试）', async () => {
  const d = await createDraft({
    userId: TENANT_A, channel: 'whatsapp', target: 'fail-case@c.us',
    content: 'will fail', senderInstance: 'instA',
  });
  const r = await confirmAndSendDraft(d.id, { userId: TENANT_A }, { dryRun: true });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'SEND_FAILED');
  assert.equal(getDraft(d.id).status, 'failed');
});

test('验收8: 无可用发送器时失败安全（NO_SENDER），不直发', async () => {
  // 模拟 bootstrap 未成功注册任何通道：用一个新通道草稿、且非 dryRun，
  // 此时 senders 中没有该键 -> 必须安全失败，绝不回退为直发。
  const d = await createDraft({
    userId: TENANT_A, channel: 'whatsapp', target: '15550001@c.us',
    content: 'no sender', senderInstance: 'instA',
  });
  // 临时移除 whatsapp 发送器：通过注册一个不可用条目（send 非函数）
  registerSenders({ whatsapp: { send: 'not-a-function' } });
  const r = await confirmAndSendDraft(d.id, { userId: TENANT_A }, { dryRun: false });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NO_SENDER');
  assert.equal(callLog.length, 0); // 未发生任何发送
  assert.equal(getDraft(d.id).status, 'failed');
});

test('过期草稿确认返回 EXPIRED', async () => {
  const d = await createDraft({
    userId: TENANT_A, channel: 'whatsapp', target: '15550001@c.us',
    content: 'old', senderInstance: 'instA',
  });
  // 手动把过期时间改到过去
  const store = _internals.loadDrafts();
  store[d.id].expiresAt = Date.now() - 1;
  _internals.saveDrafts(store);
  const r = await confirmAndSendDraft(d.id, { userId: TENANT_A }, { dryRun: true });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'EXPIRED');
  assert.equal(callLog.length, 0);
});

test('审计文件不含正文，仅含 hash/长度', async () => {
  await createDraft({
    userId: TENANT_A, channel: 'whatsapp', target: '15550001@c.us',
    content: 'TOP_SECRET_BODY_123', senderInstance: 'instA',
  });
  const auditPath = path.join(process.cwd(), 'data', 'outbound', 'outbound-audit.jsonl');
  const txt = fs.readFileSync(auditPath, 'utf-8');
  assert.ok(!txt.includes('TOP_SECRET_BODY_123'), '审计不得包含正文');
  assert.ok(txt.includes('contentHash'), '审计应含 contentHash');
});

test('listDrafts 仅返回本租户草稿', async () => {
  await createDraft({ userId: TENANT_A, channel: 'whatsapp', target: 'a@c.us', content: 'A1', senderInstance: 'i' });
  await createDraft({ userId: TENANT_A, channel: 'whatsapp', target: 'a2@c.us', content: 'A2', senderInstance: 'i' });
  await createDraft({ userId: TENANT_B, channel: 'whatsapp', target: 'b@c.us', content: 'B1', senderInstance: 'i' });
  const mine = listDrafts({ userId: TENANT_A });
  assert.equal(mine.length, 2);
  assert.ok(mine.every((x) => x.userId === TENANT_A));
});
