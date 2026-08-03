// Seeds system configuration only (subscription plans) — never fake
// accounts/customers/conversations. Plans are a real product concept (the
// marketing site has a "Bảng giá" page); tier names/limits below are this
// project's own design, not copied from preny.ai's real (inaccessible)
// pricing.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { DEMO_ACCOUNT_ID, DEMO_CHATBOT_ID, DEMO_SUBSCRIPTION_ID } from '../src/config/demoIds.js';

const prisma = new PrismaClient();

// Real Stripe Price IDs, if a real Stripe account has been set up (see
// .env.example) — left null otherwise, which billing.service.js treats as
// "not available for checkout yet" rather than fabricating a price.
const plans = [
  { name: 'Starter', priceMonthly: 0, maxFanpages: 1, maxChatbots: 1, maxConversations: 200, stripePriceId: null },
  {
    name: 'Growth', priceMonthly: 499000, maxFanpages: 3, maxChatbots: 3, maxConversations: 2000,
    stripePriceId: process.env.STRIPE_PRICE_ID_GROWTH || null
  },
  {
    name: 'Business', priceMonthly: 1499000, maxFanpages: 10, maxChatbots: 10, maxConversations: 20000,
    stripePriceId: process.env.STRIPE_PRICE_ID_BUSINESS || null
  }
];

// The real preny.ai homepage embeds its own live chat widget
// (a "bot-embed.js" script, observed in the real capture — see
// normalize/output/dom.json at the repo root) so a visitor can try the
// product without signing up first. This is the same idea, backed by a
// real (not fabricated) Account/Chatbot pair this platform's own
// operators run for that purpose — same real Claude behavior, same real
// conversation-quota enforcement as any other tenant, just self-operated.
// Fixed ids (imported from src/config/demoIds.js) so re-seeding is
// idempotent instead of creating duplicates.
async function main() {
  for (const plan of plans) {
    // Never overwrite an already-set stripePriceId with null just because
    // this run's environment didn't have the corresponding env var — that
    // would silently break checkout for a plan a real Stripe account was
    // already wired up for.
    const { stripePriceId, ...update } = plan;
    if (stripePriceId) update.stripePriceId = stripePriceId;

    await prisma.plan.upsert({
      where: { name: plan.name },
      create: plan,
      update
    });
  }

  console.log(`Seeded ${plans.length} plans`);

  const businessPlan = await prisma.plan.findUnique({ where: { name: 'Business' } });

  await prisma.account.upsert({
    where: { id: DEMO_ACCOUNT_ID },
    create: { id: DEMO_ACCOUNT_ID, name: 'Preny Clone — Demo trang chủ' },
    update: {}
  });

  await prisma.chatbot.upsert({
    where: { id: DEMO_CHATBOT_ID },
    create: {
      id: DEMO_CHATBOT_ID,
      accountId: DEMO_ACCOUNT_ID,
      name: 'Trợ lý demo trang chủ',
      systemPrompt:
        'Bạn là trợ lý AI demo trên trang chủ của Preny Clone — một sản phẩm SaaS chatbot bán hàng. ' +
        'Trả lời ngắn gọn, thân thiện bằng tiếng Việt, giới thiệu các tính năng thật của sản phẩm ' +
        '(hộp thư hợp nhất đa kênh, mini CRM tự động, tư vấn bằng hình ảnh, chuyển đổi sang nhân viên) ' +
        'và mời khách đăng ký dùng thử miễn phí 14 ngày.',
      status: 'ACTIVE'
    },
    update: {}
  });

  // Refreshed on every seed run rather than only created once, so this
  // demo tenant's trial never actually expires from an operator's
  // perspective — it's real Business-tier resource limits (20,000
  // conversations/month), not unlimited, since public homepage traffic is
  // still real load on a real account and should be governed the same
  // way any tenant's usage is.
  if (businessPlan) {
    await prisma.subscription.upsert({
      where: { id: DEMO_SUBSCRIPTION_ID },
      create: {
        id: DEMO_SUBSCRIPTION_ID,
        accountId: DEMO_ACCOUNT_ID,
        planId: businessPlan.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      },
      update: {
        planId: businessPlan.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    });
  }

  console.log('Seeded homepage demo chatbot');
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
