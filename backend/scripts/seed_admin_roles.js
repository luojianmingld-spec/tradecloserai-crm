// Seed default admin roles
import { PrismaClient } from '@prisma/client';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const prisma = new PrismaClient();

const ROLES = [
  {
    name: '超级管理员',
    code: 'super_admin',
    description: '全权限，不可被其他管理员操作',
    isBuiltin: true,
    permissions: JSON.stringify(['*']),
  },
  {
    name: '运营管理员',
    code: 'ops_admin',
    description: '用户运营+订阅管理+公告推送',
    isBuiltin: true,
    permissions: JSON.stringify([
      'dashboard:view', 'dashboard:edit',
      'user:view', 'user:edit', 'user:ban',
      'subscription:view', 'subscription:edit',
      'credit:view', 'credit:edit', 'credit:batch',
      'sponsor:view', 'sponsor:edit',
      'agent:view', 'agent:config', 'agent:alert',
      'skill_store:view', 'skill_store:edit',
      'ops:announce', 'ops:import_export',
      'permission:manage',
    ]),
  },
  {
    name: '客服专员',
    code: 'cs_agent',
    description: '用户查询+轻量操作（充值积分、解封）',
    isBuiltin: true,
    permissions: JSON.stringify([
      'dashboard:view',
      'user:view', 'user:edit',
      'credit:view', 'credit:edit',
      'sponsor:view',
      'agent:view',
    ]),
  },
  {
    name: '财务管理员',
    code: 'finance_admin',
    description: '只读Dashboard+订阅/收入/积分数据查看+导出',
    isBuiltin: true,
    permissions: JSON.stringify([
      'dashboard:view',
      'subscription:view',
      'credit:view',
    ]),
  },
  {
    name: '只读观察者',
    code: 'readonly_viewer',
    description: '纯数据查看，零写权限',
    isBuiltin: true,
    permissions: JSON.stringify([
      'dashboard:view',
    ]),
  },
];

async function main() {
  for (const role of ROLES) {
    await prisma.adminRole.upsert({
      where: { code: role.code },
      update: role,
      create: role,
    });
    console.log(`Role ${role.code} created/updated`);
  }

  // Ensure default super admin exists
  const existingSuperAdmin = await prisma.adminUser.findFirst({
    where: { role: { code: 'super_admin' } },
  });

  if (!existingSuperAdmin) {
    const superRole = await prisma.adminRole.findUnique({ where: { code: 'super_admin' } });
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('Admin123Test', 10);
    
    await prisma.adminUser.create({
      data: {
        username: 'admin',
        email: 'admin@tradecloserai.com',
        password: hashedPassword,
        name: '超级管理员',
        roleId: superRole.id,
        status: 'active',
      },
    });
    console.log('Default super admin created (admin / Admin123Test)');
  } else {
    console.log('Super admin already exists');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
