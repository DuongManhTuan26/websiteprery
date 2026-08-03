// Seeds system configuration only (subscription plans) — never fake
// accounts/customers/conversations. Plans are a real product concept (the
// marketing site has a "Bảng giá" page); tier names/limits below are this
// project's own design, not copied from preny.ai's real (inaccessible)
// pricing.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  { name: 'Starter', priceMonthly: 0, maxFanpages: 1, maxChatbots: 1, maxConversations: 200 },
  { name: 'Growth', priceMonthly: 499000, maxFanpages: 3, maxChatbots: 3, maxConversations: 2000 },
  { name: 'Business', priceMonthly: 1499000, maxFanpages: 10, maxChatbots: 10, maxConversations: 20000 }
];

async function main() {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      create: plan,
      update: plan
    });
  }

  console.log(`Seeded ${plans.length} plans`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
