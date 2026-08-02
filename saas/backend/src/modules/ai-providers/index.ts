import { ValidationError } from '../../middleware/errorHandler.js';
import { MockAIProvider } from './mockProvider.js';
import { OpenAIProvider } from './openaiProvider.js';
import type { AIProvider } from './types.js';
import type { AIProviderType } from '../../generated/prisma/enums.js';

// API-key retrieval (decrypting a workspace's stored key) is wired up in
// the settings phase — this factory takes an already-decrypted key so it
// has no dependency on that module's internals, only on the enum + a
// string. A chatbot configured for OPENAI without a key throws a clear,
// explicit error rather than silently falling back to Mock (that fallback
// would hide a real misconfiguration behind fake-looking success).
export function getProvider(providerType: AIProviderType, apiKey?: string | null): AIProvider {
  switch (providerType) {
    case 'MOCK':
      return new MockAIProvider();
    case 'OPENAI':
      if (!apiKey) {
        throw new ValidationError('This chatbot is configured for OpenAI but the workspace has no API key set — add one in Settings.');
      }
      return new OpenAIProvider(apiKey);
    default:
      throw new ValidationError(`Unknown AI provider: ${providerType satisfies never}`);
  }
}

export type { AIProvider, ChatMessage, GenerateReplyInput } from './types.js';
