import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const rows = await prisma.aIModelConfig.findMany({ orderBy:[{id:'asc'}] });
for (const r of rows) {
  console.log(JSON.stringify({id:r.id, displayName:r.displayName, modelName:r.modelName, provider:r.provider, isEnabled:r.isEnabled, config:r.config}));
}
await prisma.$disconnect();
