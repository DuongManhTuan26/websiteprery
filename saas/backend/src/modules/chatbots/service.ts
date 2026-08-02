import { prisma } from '../../db/client.js';
import { NotFoundError } from '../../middleware/errorHandler.js';
import type { AIProviderType } from '../../generated/prisma/enums.js';

export interface CreateChatbotInput {
  name: string;
  systemPrompt?: string;
  aiProvider?: AIProviderType;
  aiModel?: string;
}

export interface UpdateChatbotInput {
  name?: string;
  systemPrompt?: string;
  aiProvider?: AIProviderType;
  aiModel?: string | null;
  isActive?: boolean;
}

export async function createChatbot(workspaceId: string, input: CreateChatbotInput) {
  return prisma.chatbot.create({
    data: {
      workspaceId,
      name: input.name,
      ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
      ...(input.aiProvider ? { aiProvider: input.aiProvider } : {}),
      ...(input.aiModel ? { aiModel: input.aiModel } : {})
    }
  });
}

export async function listChatbots(workspaceId: string) {
  return prisma.chatbot.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } });
}

async function findOwnedChatbot(workspaceId: string, chatbotId: string) {
  const chatbot = await prisma.chatbot.findFirst({ where: { id: chatbotId, workspaceId } });
  if (!chatbot) throw new NotFoundError('Chatbot not found');
  return chatbot;
}

export async function getChatbot(workspaceId: string, chatbotId: string) {
  return findOwnedChatbot(workspaceId, chatbotId);
}

export async function updateChatbot(workspaceId: string, chatbotId: string, input: UpdateChatbotInput) {
  await findOwnedChatbot(workspaceId, chatbotId);
  return prisma.chatbot.update({ where: { id: chatbotId }, data: input });
}

export async function deleteChatbot(workspaceId: string, chatbotId: string) {
  await findOwnedChatbot(workspaceId, chatbotId);
  await prisma.chatbot.delete({ where: { id: chatbotId } });
}
