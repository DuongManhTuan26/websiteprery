import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';

// Prisma 7 requires an explicit driver adapter (no more implicit
// url-from-schema connection). Singleton — the whole process shares one
// pooled adapter/client rather than opening a pool per request.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
