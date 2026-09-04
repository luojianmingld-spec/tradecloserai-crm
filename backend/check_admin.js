const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const a = await p.adminUser.findFirst({ where: { id: 0 } });
  console.log("AdminUser id=0:", a ? JSON.stringify(a.username) : "不存在");
  try {
    await p.$transaction(async (tx) => {
      const rec = await tx.auditLog.create({
        data: { adminId: 0, action: "test_fk", targetType: "user", targetId: "0", riskLevel: "low", reason: "fk-test" },
      });
      console.log("adminId=0 可插入, id=", rec.id);
      throw new Error("ROLLBACK_NOW");
    });
  } catch (e) {
    if (e.message === "ROLLBACK_NOW") console.log("事务已回滚（验证通过）");
    else console.log("adminId=0 插入失败:", e.message);
  }
  await p.$disconnect();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
