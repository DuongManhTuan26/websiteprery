import { prisma } from '../../db/client.js';
import { NotFoundError } from '../../middleware/errorHandler.js';

export interface ContactInput {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  tags?: string[];
}

async function findOwnedContact(workspaceId: string, contactId: string) {
  const contact = await prisma.contact.findFirst({ where: { id: contactId, workspaceId } });
  if (!contact) throw new NotFoundError('Contact not found');
  return contact;
}

export async function createContact(workspaceId: string, input: ContactInput) {
  return prisma.contact.create({ data: { workspaceId, ...input } });
}

export async function listContacts(workspaceId: string) {
  return prisma.contact.findMany({
    where: { workspaceId },
    include: { _count: { select: { conversations: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getContact(workspaceId: string, contactId: string) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
    include: {
      conversations: {
        orderBy: { updatedAt: 'desc' },
        include: {
          chatbot: { select: { id: true, name: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } }
        }
      }
    }
  });
  if (!contact) throw new NotFoundError('Contact not found');

  return {
    ...contact,
    conversations: contact.conversations.map(c => ({
      id: c.id,
      channel: c.channel,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      chatbot: c.chatbot,
      messageCount: c._count.messages,
      lastMessage: c.messages[0] ?? null
    }))
  };
}

export async function updateContact(workspaceId: string, contactId: string, input: ContactInput) {
  await findOwnedContact(workspaceId, contactId);
  return prisma.contact.update({ where: { id: contactId }, data: input });
}

export async function deleteContact(workspaceId: string, contactId: string) {
  await findOwnedContact(workspaceId, contactId);
  await prisma.contact.delete({ where: { id: contactId } });
}
