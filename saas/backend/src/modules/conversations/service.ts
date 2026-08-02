import { prisma } from '../../db/client.js';
import { NotFoundError } from '../../middleware/errorHandler.js';

// Every query here filters by `chatbot: { workspaceId }` rather than
// trusting a conversation id alone — the same tenant-isolation discipline
// as chatbots/service.ts, just one join deeper.
export async function listConversations(workspaceId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { chatbot: { workspaceId } },
    include: {
      chatbot: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { messages: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return conversations.map(c => ({
    id: c.id,
    channel: c.channel,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    chatbot: c.chatbot,
    messageCount: c._count.messages,
    lastMessage: c.messages[0] ?? null
  }));
}

export async function getConversation(workspaceId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, chatbot: { workspaceId } },
    include: {
      chatbot: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: 'asc' } }
    }
  });

  if (!conversation) throw new NotFoundError('Conversation not found');
  return conversation;
}
