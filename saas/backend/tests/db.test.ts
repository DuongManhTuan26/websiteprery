import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.js';

describe('database connectivity', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to the real test database and can round-trip a user row', async () => {
    const email = `db-test-${Date.now()}@example.com`;

    const created = await prisma.user.create({
      data: { email, passwordHash: 'not-a-real-hash', name: 'DB Test User' }
    });

    expect(created.id).toBeTruthy();

    const found = await prisma.user.findUnique({ where: { email } });
    expect(found?.name).toBe('DB Test User');

    await prisma.user.delete({ where: { id: created.id } });
  });
});
