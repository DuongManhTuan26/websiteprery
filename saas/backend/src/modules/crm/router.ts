import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole, requireWorkspaceMember } from '../../middleware/requireWorkspaceMember.js';
import { parseOrThrow } from '../../utils/validate.js';
import { createContactSchema, updateContactSchema } from './schemas.js';
import * as contactService from './service.js';

// Mounted at /workspaces/:workspaceId/contacts.
export const crmRouter = Router({ mergeParams: true });

crmRouter.use(requireAuth, requireWorkspaceMember);

crmRouter.post('/', async (req, res, next) => {
  try {
    const input = parseOrThrow(createContactSchema, req.body);
    const contact = await contactService.createContact(req.workspaceId!, input);
    res.status(201).json({ contact });
  } catch (err) {
    next(err);
  }
});

crmRouter.get('/', async (req, res, next) => {
  try {
    const contacts = await contactService.listContacts(req.workspaceId!);
    res.json({ contacts });
  } catch (err) {
    next(err);
  }
});

crmRouter.get('/:contactId', async (req, res, next) => {
  try {
    const contact = await contactService.getContact(req.workspaceId!, String(req.params.contactId));
    res.json({ contact });
  } catch (err) {
    next(err);
  }
});

crmRouter.patch('/:contactId', async (req, res, next) => {
  try {
    const input = parseOrThrow(updateContactSchema, req.body);
    const contact = await contactService.updateContact(req.workspaceId!, String(req.params.contactId), input);
    res.json({ contact });
  } catch (err) {
    next(err);
  }
});

crmRouter.delete('/:contactId', requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    await contactService.deleteContact(req.workspaceId!, String(req.params.contactId));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
