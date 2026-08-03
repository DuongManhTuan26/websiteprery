import { prisma } from '../lib/prisma.js';
import { asyncHandler, ApiError } from './errorHandler.js';

// Deliberately re-queries the User row on every request rather than
// trusting an `isPlatformAdmin` claim baked into the JWT — this route
// guards platform-wide data (every tenant's Leads), so a demotion must
// take effect immediately, not wait out the access token's TTL like an
// ordinary permission change would be allowed to.
export const requirePlatformAdmin = asyncHandler(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (!user?.isPlatformAdmin) {
    throw new ApiError(403, 'Platform admin access required');
  }

  next();
});
