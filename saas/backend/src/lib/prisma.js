import { PrismaClient } from '@prisma/client';

// Single shared client — Prisma manages its own connection pool internally;
// creating a new PrismaClient per request would exhaust connections.
export const prisma = new PrismaClient();
