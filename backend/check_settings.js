const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const settings = await prisma.systemSetting.findMany({where: {key: {startsWith: "ai_"}}});
  console.log(JSON.stringify(settings, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
