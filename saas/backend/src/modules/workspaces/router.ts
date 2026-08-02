import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole, requireWorkspaceMember } from '../../middleware/requireWorkspaceMember.js';
import { parseOrThrow } from '../../utils/validate.js';
import {
  addMemberSchema,
  createWorkspaceSchema,
  updateMemberRoleSchema,
  updateWorkspaceSchema
} from './schemas.js';
import * as workspaceService from './service.js';

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth);

workspacesRouter.post('/', async (req, res, next) => {
  try {
    const { name } = parseOrThrow(createWorkspaceSchema, req.body);
    const workspace = await workspaceService.createWorkspace(req.userId!, name);
    res.status(201).json({ workspace });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.get('/', async (req, res, next) => {
  try {
    const workspaces = await workspaceService.listWorkspacesForUser(req.userId!);
    res.json({ workspaces });
  } catch (err) {
    next(err);
  }
});

const memberRouter = Router({ mergeParams: true });

workspacesRouter.use('/:workspaceId', requireWorkspaceMember, memberRouter);

memberRouter.get('/', async (req, res, next) => {
  try {
    const workspace = await workspaceService.getWorkspace(req.workspaceId!);
    res.json({ workspace: { ...workspace, role: req.workspaceRole } });
  } catch (err) {
    next(err);
  }
});

memberRouter.patch('/', requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const { name } = parseOrThrow(updateWorkspaceSchema, req.body);
    const workspace = await workspaceService.updateWorkspace(req.workspaceId!, name);
    res.json({ workspace });
  } catch (err) {
    next(err);
  }
});

memberRouter.delete('/', requireRole('OWNER'), async (req, res, next) => {
  try {
    await workspaceService.deleteWorkspace(req.workspaceId!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

memberRouter.get('/members', async (req, res, next) => {
  try {
    const members = await workspaceService.listMembers(req.workspaceId!);
    res.json({ members });
  } catch (err) {
    next(err);
  }
});

memberRouter.post('/members', requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const { email, role } = parseOrThrow(addMemberSchema, req.body);
    const member = await workspaceService.addMember(req.workspaceId!, email, role ?? 'MEMBER');
    res.status(201).json({ member });
  } catch (err) {
    next(err);
  }
});

memberRouter.patch('/members/:userId', requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const { role } = parseOrThrow(updateMemberRoleSchema, req.body);
    const member = await workspaceService.updateMemberRole(
      req.workspaceId!,
      req.workspaceRole!,
      String(req.params.userId),
      role
    );
    res.json({ member });
  } catch (err) {
    next(err);
  }
});

memberRouter.delete('/members/:userId', requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    await workspaceService.removeMember(req.workspaceId!, req.workspaceRole!, String(req.params.userId));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
