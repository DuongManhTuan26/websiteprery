// Promotes an existing user to platform admin (Lead visibility — see
// src/routes/admin.routes.js). Deliberately a manual CLI script, not an
// API endpoint: there is no self-service way to become a platform
// operator, by design.
//
// Usage: node scripts/promote-admin.js user@example.com
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/promote-admin.js <email>');
  process.exit(1);
}

const user = await prisma.user.update({
  where: { email },
  data: { isPlatformAdmin: true }
}).catch(err => {
  console.error(`Could not promote ${email}:`, err.message);
  process.exit(1);
});

console.log(`${user.email} is now a platform admin.`);
await prisma.$disconnect();
