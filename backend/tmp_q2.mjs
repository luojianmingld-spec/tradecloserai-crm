import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const cs = await p.customer.findMany();
for (const c of cs) {
  if (c.requirementSummary) {
    console.log('=== cust', c.id, c.name, 'len=', c.requirementSummary.length);
    console.log(c.requirementSummary.substring(0, 800));
    console.log('products=', c.requirementProducts, 'budget=', c.requirementBudget, 'quantity=', c.requirementQuantity, 'delivery=', c.requirementDelivery);
    console.log('---');
  }
}
await p.$disconnect();
