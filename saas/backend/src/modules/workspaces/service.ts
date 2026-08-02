import { prisma } from '../../db/client.js';
import { slugify } from '../../utils/slug.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../middleware/errorHandler.js';
import type { WorkspaceRole } from '../../generated/prisma/enums.js';

export async function createWorkspace(userId: string, name: string) {
  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug: slugify(name),
      members: { create: { userId, role: 'OWNER' } }
    }
  });

  return workspace;
}

export async function listWorkspacesForUser(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' }
  });

  return memberships.map(m => ({ ...m.workspace, role: m.role }));
}

export async function getWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new NotFoundError('Workspace not found');
  return workspace;
}

export async function updateWorkspace(workspaceId: string, name: string) {
  return prisma.workspace.update({ where: { id: workspaceId }, data: { name } });
}

export async function deleteWorkspace(workspaceId: string) {
  await prisma.workspace.delete({ where: { id: workspaceId } });
}

export async function listMembers(workspaceId: string) {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: 'asc' }
  });

  return members.map(m => ({ userId: m.userId, role: m.role, user: m.user }));
}

async function countOwners(workspaceId: string): Promise<number> {
  return prisma.workspaceMember.count({ where: { workspaceId, role: 'OWNER' } });
}

export async function addMember(workspaceId: string, email: string, role: WorkspaceRole) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new NotFoundError('No registered user with that email — they must create an account first');
  }

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } }
  });
  if (existing) {
    throw new ConflictError('This user is already a member of the workspace');
  }

  const member = await prisma.workspaceMember.create({
    data: { workspaceId, userId: user.id, role }
  });

  return { userId: member.userId, role: member.role, user: { id: user.id, email: user.email, name: user.name } };
}

// ADMINs may only remove/modify plain MEMBERs — not other ADMINs, and never
// an OWNER. Only an OWNER can touch an ADMIN or another OWNER. This is
// enforced here (not just via route-level requireRole) because it depends
// on comparing the *target's* role, not just the actor's.
function assertActorCanModifyTarget(actorRole: WorkspaceRole, targetRole: WorkspaceRole) {
  if (actorRole === 'OWNER') return;
  if (actorRole === 'ADMIN' && targetRole === 'MEMBER') return;
  throw new ForbiddenError('Insufficient permissions to modify this member');
}

export async function removeMember(workspaceId: string, actorRole: WorkspaceRole, targetUserId: string) {
  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } }
  });
  if (!target) throw new NotFoundError('Member not found');

  assertActorCanModifyTarget(actorRole, target.role);

  if (target.role === 'OWNER' && (await countOwners(workspaceId)) <= 1) {
    throw new ForbiddenError('Cannot remove the last owner of a workspace');
  }

  await prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId: targetUserId } } });
}

export async function updateMemberRole(
  workspaceId: string,
  actorRole: WorkspaceRole,
  targetUserId: string,
  role: WorkspaceRole
) {
  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } }
  });
  if (!target) throw new NotFoundError('Member not found');

  assertActorCanModifyTarget(actorRole, target.role);

  if (actorRole !== 'OWNER' && role === 'OWNER') {
    throw new ForbiddenError('Only an owner can grant owner access');
  }

  if (target.role === 'OWNER' && role !== 'OWNER' && (await countOwners(workspaceId)) <= 1) {
    throw new ValidationError('Cannot demote the last owner — promote another member to owner first');
  }

  return prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    data: { role }
  });
}
