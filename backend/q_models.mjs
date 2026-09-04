import { PrismaClient } from '@prisma/client';
import { decrypt, isEncrypted } from './src/utils/encryption.js';
const prisma = new PrismaClient();
const key = 'aIModelConfig';
const models = await prisma[key].findMany();
console.log('=== AIModelConfig count:', models.length);
for (const m of models) {
  const raw = m.apiKey ? (isEncrypted(m.apiKey) ? decrypt(m.apiKey) : m.apiKey) : null;
  console.log(JSON.stringify({id:m.id, tenantId:m.tenantId, provider:m.provider, modelName:m.modelName, displayName:m.displayName, baseUrl:m.baseUrl, isEnabled:m.isEnabled, apiKeySet:!!raw, keyPrefix:raw?raw.slice(0,8):null}));
}
const s = await prisma.setting.findUnique({ where: { userId_key: { userId: 1, key: 'ai_providers' } } });
let provs = [];
if (s) { const dec = isEncrypted(s.value)?decrypt(s.value):s.value; try { provs = JSON.parse(dec);}catch{} }
console.log('=== settings ai_providers count:', provs.length);
for (const p of provs) console.log(JSON.stringify({id:p.id, name:p.name, provider:p.provider, model:p.model, baseUrl:p.baseUrl, isDefault:p.isDefault, apiKeySet:!!p.apiKey, keyPrefix:p.apiKey?p.apiKey.slice(0,8):null}));
const act = await prisma.setting.findUnique({ where: { userId_key: { userId: 1, key: 'ai_active_id' } } });
console.log('=== ai_active_id:', act && act.value);
await prisma.$disconnect();
