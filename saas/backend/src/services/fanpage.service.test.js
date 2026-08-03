import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.js';
import { createDefaultSubscription } from './plan.service.js';
import { connectFanpages } from './fanpage.service.js';

// connectFanpages is exercised directly (not through the HTTP route) so
// this doesn't need a real Facebook OAuth code exchange — the accountId/
// pageId ownership logic is what's under test, not the real network call
// exchangeCodeForPageTokens makes (this suite never hits real third-party
// APIs — see billing.service.test.js for the same policy).

async function newAccount() {
  const account = await prisma.account.create({ data: { name: `Fanpage Test ${Date.now()}-${Math.random()}` } });
  await createDefaultSubscription(account.id);
  return account.id;
}

test('connecting a fresh page creates a real Fanpage row owned by the connecting account', async () => {
  const accountId = await newAccount();
  const pageId = `page-${Date.now()}-a`;

  const created = await connectFanpages(accountId, [{ pageId, pageName: 'Test Page', accessToken: 'tok-1' }]);

  assert.equal(created.length, 1);
  assert.equal(created[0].accountId, accountId);
  assert.equal(created[0].pageId, pageId);
});

test('reconnecting the same page from the SAME account updates it in place (real token rotation)', async () => {
  const accountId = await newAccount();
  const pageId = `page-${Date.now()}-b`;

  await connectFanpages(accountId, [{ pageId, pageName: 'Test Page', accessToken: 'tok-old' }]);
  const [updated] = await connectFanpages(accountId, [{ pageId, pageName: 'Test Page', accessToken: 'tok-new' }]);

  assert.equal(updated.accountId, accountId);
  assert.equal(updated.accessToken, 'tok-new');

  const rows = await prisma.fanpage.findMany({ where: { pageId } });
  assert.equal(rows.length, 1, 'must still be exactly one row, not a duplicate');
});

test('connecting a page already owned by a DIFFERENT account is rejected, not silently hijacked', async () => {
  const ownerAccountId = await newAccount();
  const otherAccountId = await newAccount();
  const pageId = `page-${Date.now()}-c`;

  await connectFanpages(ownerAccountId, [{ pageId, pageName: 'Owner Page', accessToken: 'owner-token' }]);

  await assert.rejects(
    () => connectFanpages(otherAccountId, [{ pageId, pageName: 'Owner Page', accessToken: 'attacker-token' }]),
    err => err.status === 409
  );

  // The original row must be completely untouched — this is the actual
  // bug this test guards against: a global upsert-by-pageId silently
  // overwriting another tenant's real accessToken.
  const row = await prisma.fanpage.findUnique({ where: { pageId } });
  assert.equal(row.accountId, ownerAccountId);
  assert.equal(row.accessToken, 'owner-token');
});
