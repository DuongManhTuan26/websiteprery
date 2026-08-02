import type { AIProvider, GenerateReplyInput } from './types.js';

// Deterministic, offline, zero external credentials — the default provider
// so the system is runnable and testable out of the box. Its replies are
// explicitly, visibly synthetic (never phrased to look like a real model's
// output) so nobody mistakes a demo/dev environment for one backed by a
// real LLM.
export class MockAIProvider implements AIProvider {
  async generateReply(input: GenerateReplyInput): Promise<string> {
    const trimmed = input.userMessage.trim();
    const preview = trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;

    if (!trimmed) {
      return '[mock-ai] (no message received)';
    }

    if (trimmed.endsWith('?')) {
      return `[mock-ai] That's a good question about "${preview}" — a real answer needs a configured AI provider (see Settings).`;
    }

    return `[mock-ai] Got it: "${preview}". This is a deterministic placeholder reply from the Mock provider, not a real AI response.`;
  }
}
