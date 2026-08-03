import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/errorHandler.js';
import { enforceResourceLimit } from './plan.service.js';

// Fanpage.pageId is globally unique (one real Facebook Page can only be
// "the" row once), but that's a database constraint, not a tenant-
// isolation guarantee — extracted here (out of fanpages.routes.js) so the
// account-ownership check is independently testable without a real
// Facebook OAuth round-trip (exchangeCodeForPageTokens needs a real
// network call this test suite deliberately never makes).
export async function connectFanpages(accountId, pages) {
  const existing = await prisma.fanpage.findMany({ where: { pageId: { in: pages.map(p => p.pageId) } } });
  const existingByPageId = new Map(existing.map(f => [f.pageId, f]));

  // A page already connected to a DIFFERENT account must be rejected, not
  // silently reassigned — the original code here did a global upsert
  // keyed only on pageId, which would have overwritten another tenant's
  // fanpage row (including its real accessToken) with this account's
  // OAuth result. Found while auditing tenant isolation across every
  // route, not from an exploit report — a real Page Access Token can
  // only be obtained by someone who actually administers that Facebook
  // Page, so this is a data-integrity bug (e.g. an agency managing pages
  // across more than one tenant account here), not a remotely triggered
  // attack.
  const conflicting = pages.filter(p => {
    const row = existingByPageId.get(p.pageId);
    return row && row.accountId !== accountId;
  });

  if (conflicting.length > 0) {
    throw new ApiError(
      409,
      `Trang đã được kết nối với một tài khoản khác trên hệ thống: ${conflicting.map(p => p.pageName).join(', ')}`
    );
  }

  const newPageCount = pages.filter(p => !existingByPageId.has(p.pageId)).length;

  if (newPageCount > 0) {
    await enforceResourceLimit(accountId, 'fanpage', newPageCount);
  }

  return Promise.all(pages.map(page =>
    prisma.fanpage.upsert({
      where: { pageId: page.pageId },
      create: { accountId, pageId: page.pageId, pageName: page.pageName, accessToken: page.accessToken },
      // Safe now: this branch only ever runs for a page already confirmed
      // above to belong to this same account.
      update: { accessToken: page.accessToken, pageName: page.pageName, status: 'CONNECTED' }
    })
  ));
}
