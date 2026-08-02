import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/client.js';
import { ForbiddenError, UnauthorizedError } from './errorHandler.js';
import type { WorkspaceRole } from '../generated/prisma/enums.js';

// Resolves `:workspaceId` from the route, requires req.userId to already be
// set (mount after requireAuth), and 403s if no WorkspaceMember row exists
// — there is no cross-tenant query path in this codebase; a missing
// membership is a 403, never a silently-empty/filtered result set.
export async function requireWorkspaceMember(req: Request, _res: Response, next: NextFunction) {
  if (!req.userId) {
    return next(new UnauthorizedError());
  }

  const workspaceId = String(req.params.workspaceId);

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: req.userId } }
  });

  if (!membership) {
    return next(new ForbiddenError('You are not a member of this workspace'));
  }

  req.workspaceId = workspaceId;
  req.workspaceRole = membership.role;
  next();
}

// Mount after requireWorkspaceMember. Usage: requireRole('OWNER', 'ADMIN').
export function requireRole(...allowed: WorkspaceRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.workspaceRole || !allowed.includes(req.workspaceRole)) {
      return next(new ForbiddenError(`Requires one of these roles: ${allowed.join(', ')}`));
    }
    next();
  };
}
