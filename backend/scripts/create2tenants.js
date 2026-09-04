import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  const tenants = [
    { code: 'test-002', name: '测试租户B', username: 'test_t2_admin', password: 'Test123456', plan: 'pro', balance: 1000 },
    { code: 'test-003', name: '测试租户C', username: 'test_t3_admin', password: 'Test123456', plan: 'pro', balance: 1000 },
  ];
  for (const t of tenants) {
    const existTenant = await prisma.tenant.findUnique({ where: { code: t.code } });
    const existUser = await prisma.user.findUnique({ where: { username: t.username } });
    if (existTenant) { console.log('SKIP tenant exists:', t.code); continue; }
    if (existUser) { console.log('SKIP user exists:', t.username); continue; }
    const hash = await bcrypt.hash(t.password, 10);
    const admin = await prisma.user.create({
      data: { username: t.username, password: hash, name: t.name + '管理员', role: 'ADMIN', tenantId: 0 }
    });
    const tenant = await prisma.tenant.create({
      data: { name: t.name, code: t.code, status: 'trial', plan: t.plan, balance: t.balance, adminUserId: admin.id }
    });
    await prisma.user.update({ where: { id: admin.id }, data: { tenantId: tenant.id } });
    console.log('OK', tenant.code, tenant.name, admin.username, t.password, 'tenantId=' + tenant.id);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
