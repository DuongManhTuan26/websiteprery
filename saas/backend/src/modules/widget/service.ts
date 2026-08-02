import { prisma } from '../../db/client.js';
import { ForbiddenError, NotFoundError } from '../../middleware/errorHandler.js';
import { getProvider } from '../ai-providers/index.js';
import type { ChatMessage } from '../ai-providers/types.js';

export interface PublicChatbotConfig {
  name: string;
  isActive: boolean;
}

async function findActiveChatbotByToken(widgetToken: string) {
  const chatbot = await prisma.chatbot.findUnique({ where: { widgetToken } });
  if (!chatbot) throw new NotFoundError('Unknown widget token');
  if (!chatbot.isActive) throw new ForbiddenError('This chatbot is currently inactive');
  return chatbot;
}

export async function getPublicConfig(widgetToken: string): Promise<PublicChatbotConfig> {
  const chatbot = await findActiveChatbotByToken(widgetToken);
  return { name: chatbot.name, isActive: chatbot.isActive };
}

// Loads (or starts) a real, persisted conversation and appends both sides
// of the exchange to it — the AI provider only ever sees history this
// server actually stored, never anything the client claims happened.
export async function sendMessage(
  widgetToken: string,
  message: string,
  conversationId?: string
): Promise<{ reply: string; conversationId: string }> {
  const chatbot = await findActiveChatbotByToken(widgetToken);

  let conversation;
  if (conversationId) {
    conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, chatbotId: chatbot.id }
    });
    if (!conversation) throw new NotFoundError('Unknown conversation');
  } else {
    conversation = await prisma.conversation.create({ data: { chatbotId: chatbot.id } });
  }

  const priorMessages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' }
  });

  const history: ChatMessage[] = priorMessages.map(m => ({
    role: m.role === 'USER' ? 'user' : 'assistant',
    content: m.content
  }));

  await prisma.message.create({ data: { conversationId: conversation.id, role: 'USER', content: message } });

  const provider = getProvider(chatbot.aiProvider, undefined);
  const reply = await provider.generateReply({
    systemPrompt: chatbot.systemPrompt,
    history,
    userMessage: message,
    model: chatbot.aiModel
  });

  await prisma.message.create({ data: { conversationId: conversation.id, role: 'ASSISTANT', content: reply } });
  await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

  return { reply, conversationId: conversation.id };
}
