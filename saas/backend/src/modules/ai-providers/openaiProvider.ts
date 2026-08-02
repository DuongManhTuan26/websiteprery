import { UpstreamError } from '../../middleware/errorHandler.js';
import type { AIProvider, GenerateReplyInput } from './types.js';

const DEFAULT_MODEL = 'gpt-4o-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// Real, optional integration — disabled unless a workspace has configured a
// real OpenAI API key (see the settings phase). Talks to the Chat
// Completions API directly over fetch rather than pulling in the `openai`
// SDK, since this is the only call this system needs and it keeps the
// dependency footprint (and attack surface) small.
//
// NOTE ON VERIFICATION: outbound network to api.openai.com is not reachable
// from the sandbox this was built in (only a small egress allowlist is
// permitted — see the root repo's CLAUDE.md for the same constraint
// documented against the capture pipeline). This class is therefore
// verified by a unit test against a mocked `fetch` (request shape, response
// parsing, and error handling), not against the real API. Treat the first
// real call in an environment with internet access as this code path's
// actual end-to-end verification.
export class OpenAIProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async generateReply(input: GenerateReplyInput): Promise<string> {
    const messages = [
      { role: 'system' as const, content: input.systemPrompt },
      ...input.history,
      { role: 'user' as const, content: input.userMessage }
    ];

    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: input.model || DEFAULT_MODEL,
          messages
        })
      });
    } catch (err) {
      throw new UpstreamError(`Failed to reach OpenAI: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new UpstreamError(`OpenAI request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new UpstreamError('OpenAI response did not include a message');
    }

    return content;
  }
}
