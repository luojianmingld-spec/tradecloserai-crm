import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt, isEncrypted } from './src/utils/encryption.js';
const prisma = new PrismaClient();
// 读取旧租户 provider
const s = await prisma.setting.findUnique({ where: { userId_key: { userId: 1, key: 'ai_providers' } } });
const raw = isEncrypted(s.value) ? decrypt(s.value) : s.value;
const provs = JSON.parse(raw);
console.log('legacy providers:', provs.length);
// 检查平台池是否已有
const existing = await prisma['aIModelConfig'].findMany({ where: { tenantId: 0 } });
console.log('existing pool count:', existing.length);
if (existing.length === 0) {
  const created = [];
  for (const p of provs) {
    const m = await prisma['aIModelConfig'].create({
      data: {
        tenantId: 0,
        provider: p.provider || 'openai',
        modelName: p.model,
        displayName: p.name,
        apiKey: p.apiKey ? encrypt(p.apiKey) : null,
        baseUrl: p.baseUrl || null,
        isEnabled: true,
        config: JSON.stringify({ legacyId: p.id, isDefault: !!p.isDefault }),
      },
    });
    created.push({ id: m.id, legacyId: p.id, name: p.displayName || p.modelName, modelName: m.modelName });
  }
  console.log('created pool models:', created.length);
  for (const c of created) console.log(JSON.stringify(c));
} else {
  console.log('pool already has data, skip migration');
}
await prisma.$disconnect();
