import { prisma } from '../../db/client.js';
import { decrypt, encrypt } from '../../utils/encryption.js';
import { NotFoundError } from '../../middleware/errorHandler.js';
import type { AIProviderType } from '../../generated/prisma/enums.js';

export interface ApiKeyStatus {
  provider: AIProviderType;
  configured: boolean;
  updatedAt: Date | null;
}

// Never returns the plaintext or ciphertext key — only whether one is
// configured and when it was last set, consistent with ARCHITECTURE.md's
// "write-only from the API's perspective" security note.
export async function listApiKeyStatuses(workspaceId: string): Promise<ApiKeyStatus[]> {
  const keys = await prisma.apiKey.findMany({ where: { workspaceId } });
  const byProvider = new Map(keys.map(k => [k.provider, k]));

  return (['OPENAI'] as AIProviderType[]).map(provider => {
    const key = byProvider.get(provider);
    return { provider, configured: Boolean(key), updatedAt: key?.updatedAt ?? null };
  });
}

export async function setApiKey(workspaceId: string, provider: AIProviderType, apiKey: string): Promise<ApiKeyStatus> {
  const encryptedKey = encrypt(apiKey);

  const record = await prisma.apiKey.upsert({
    where: { workspaceId_provider: { workspaceId, provider } },
    create: { workspaceId, provider, encryptedKey },
    update: { encryptedKey }
  });

  return { provider, configured: true, updatedAt: record.updatedAt };
}

export async function deleteApiKey(workspaceId: string, provider: AIProviderType): Promise<void> {
  const existing = await prisma.apiKey.findUnique({ where: { workspaceId_provider: { workspaceId, provider } } });
  if (!existing) throw new NotFoundError('No API key configured for this provider');

  await prisma.apiKey.delete({ where: { workspaceId_provider: { workspaceId, provider } } });
}

// Used by chatbots/service.ts and widget/service.ts to get a real,
// decrypted key for actually calling a provider — the one place plaintext
// briefly exists outside encryption.ts, and only ever in server memory for
// the duration of one outbound request.
export async function getDecryptedApiKey(workspaceId: string, provider: AIProviderType): Promise<string | null> {
  const record = await prisma.apiKey.findUnique({ where: { workspaceId_provider: { workspaceId, provider } } });
  return record ? decrypt(record.encryptedKey) : null;
}
