import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../src/modules/ai-providers/openaiProvider.js';
import { UpstreamError } from '../src/middleware/errorHandler.js';

// api.openai.com is not reachable from this sandbox (only a small egress
// allowlist is permitted) — these tests verify the request is built
// correctly and the response is parsed/errors handled correctly against a
// mocked fetch, not the real API. See openaiProvider.ts's header comment.
describe('OpenAIProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the expected request shape and parses a successful response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Hello from the model' } }] })
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAIProvider('sk-test-key');
    const reply = await provider.generateReply({
      systemPrompt: 'You are helpful.',
      history: [{ role: 'user', content: 'earlier message' }],
      userMessage: 'What is 2+2?',
      model: 'gpt-4o-mini'
    });

    expect(reply).toBe('Hello from the model');
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(options.headers.Authorization).toBe('Bearer sk-test-key');

    const body = JSON.parse(options.body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'earlier message' },
      { role: 'user', content: 'What is 2+2?' }
    ]);
  });

  it('falls back to the default model when none is specified', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] })
    });
    vi.stubGlobal('fetch', fetchMock);

    await new OpenAIProvider('sk-test').generateReply({ systemPrompt: '', history: [], userMessage: 'hi' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-4o-mini');
  });

  it('throws UpstreamError on a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => '{"error":"invalid api key"}' })
    );

    await expect(
      new OpenAIProvider('bad-key').generateReply({ systemPrompt: '', history: [], userMessage: 'hi' })
    ).rejects.toBeInstanceOf(UpstreamError);
  });

  it('throws UpstreamError when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ENOTFOUND api.openai.com')));

    await expect(
      new OpenAIProvider('sk-test').generateReply({ systemPrompt: '', history: [], userMessage: 'hi' })
    ).rejects.toBeInstanceOf(UpstreamError);
  });

  it('throws UpstreamError when the response has no message content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }));

    await expect(
      new OpenAIProvider('sk-test').generateReply({ systemPrompt: '', history: [], userMessage: 'hi' })
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});
