/**
 * 批量创建内测租户脚本
 * 用法: node scripts/batch-create-tenants.js [数量]
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const COUNT = parseInt(process.argv[2]) || 30;

async function main() {
  console.log('开始批量创建内测租户...');
  console.log('计划创建 ' + COUNT + ' 个租户\n');

  const created = [];
  const errors = [];

  for (let i = 1; i <= COUNT; i++) {
    const code = 'beta-' + String(i).padStart(3, '0');
    const name = '内测租户 ' + String(i).padStart(2, '0');
    
    try {
      const adminPassword = await bcrypt.hash('Beta@Test' + i, 10);
      const adminUser = await prisma.user.create({
        data: {
          username: 'beta_admin_' + i,
          password: adminPassword,
          name: name + '管理员',
          role: 'ADMIN',
          tenantId: 0
        }
      });

      const tenant = await prisma.tenant.create({
        data: {
          name: name,
          code: code,
          status: 'trial',
          plan: 'pro',
          balance: 1000,
          adminUserId: adminUser.id,
          config: JSON.stringify({ maxUsers: 5, maxContacts: 500, aiEnabled: true })
        }
      });

      await prisma.user.update({
        where: { id: adminUser.id },
        data: { tenantId: tenant.id }
      });

      created.push({
        tenantId: tenant.id,
        code: tenant.code,
        name: tenant.name,
        adminUsername: adminUser.username,
        balance: tenant.balance
      });

      console.log('[' + i + '/' + COUNT + '] OK ' + name + ' (' + code + ') - 管理员: ' + adminUser.username);
    } catch (err) {
      errors.push({ index: i, code: code, error: err.message });
      console.log('[' + i + '/' + COUNT + '] FAIL ' + name + ' (' + code + ') - ' + err.message);
    }
  }

  console.log('\n========== 创建结果 ==========');
  console.log('成功: ' + created.length);
  console.log('失败: ' + errors.length);
  
  if (created.length > 0) {
    console.log('\n--- 内测租户账号列表 ---');
    created.forEach((t, idx) => {
      console.log(t.code + ' | ' + t.name + ' | ' + t.adminUsername + ' | Beta@Test' + (idx+1) + ' | ' + t.balance + '积分');
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
