// Fixed ids for the real (not fabricated) demo Account/Chatbot/Subscription
// this platform's own operators run to power the homepage's embedded chat
// widget — see prisma/seed.js (creates/refreshes them) and
// routes/demo.routes.js (exposes the widgetKey publicly). Shared here so
// the two files can't drift out of sync.
export const DEMO_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';
export const DEMO_CHATBOT_ID = '00000000-0000-0000-0000-000000000002';
export const DEMO_SUBSCRIPTION_ID = '00000000-0000-0000-0000-000000000003';
