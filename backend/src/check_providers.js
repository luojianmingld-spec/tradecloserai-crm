import { decrypt, isEncrypted } from './utils/encryption.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const s = await prisma.setting.findUnique({ where: { userId_key: { userId: 1, key: 'ai_providers' } } });
  console.log('raw length:', s?.value?.length);
  console.log('isEncrypted:', isEncrypted(s?.value));
  
  const dec = isEncrypted(s?.value) ? decrypt(s.value) : s.value;
  try {
    const providers = JSON.parse(dec);
    console.log('providers count:', providers.length);
    const active = providers.find(p => p.id === 'p1783909359131');
    console.log('active provider:', active?.name || 'NOT FOUND');
    console.log('active apiKey first 15:', active?.apiKey?.substring(0, 15));
  } catch(e) {
    console.log('parse error:', e.message);
    console.log('decrypted first 100:', dec.substring(0, 100));
  }
  
  await prisma.disconnect();
}
check().catch(e => console.error(e));
