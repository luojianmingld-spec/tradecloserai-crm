import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const pwd1 = await bcrypt.hash("Test1234Ab", 10);
  const u1 = await prisma.user.create({
    data: { username: "test_user1", password: pwd1, name: "测试用户A", role: "sales" }
  });
  console.log("User1 created:", JSON.stringify(u1));
  
  const pwd2 = await bcrypt.hash("Test5678Cd", 10);
  const u2 = await prisma.user.create({
    data: { username: "test_user2", password: pwd2, name: "测试用户B", role: "sales" }
  });
  console.log("User2 created:", JSON.stringify(u2));
}
main().catch(e => console.error(e.message)).finally(() => prisma.$disconnect());
