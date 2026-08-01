import { decrypt, isEncrypted } from './utils/encryption.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  const ea = await prisma.emailAccount.findUnique({ where: { id: 4 } });
  console.log('current parts:', ea.password.split(':').length);
  
  const parts = ea.password.split(':');
  if (parts.length === 3) {
    const inner = decrypt(ea.password);
    console.log('decrypted inner parts:', inner.split(':').length);
    await prisma.emailAccount.update({
      where: { id: 4 },
      data: { password: inner }
    });
    console.log('OK: Restored to email.js encryption format');
  } else {
    console.log('Not double-encrypted, skipping');
  }
  
  await prisma.$disconnect();
}
fix().catch(e => { console.error(e); process.exit(1); });
