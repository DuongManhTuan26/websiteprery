import { describe, expect, it } from 'vitest';
import { MockAIProvider } from '../src/modules/ai-providers/mockProvider.js';

describe('MockAIProvider', () => {
  const provider = new MockAIProvider();

  it('is deterministic for the same input', async () => {
    const input = { systemPrompt: 'You are helpful.', history: [], userMessage: 'Hello there' };
    const a = await provider.generateReply(input);
    const b = await provider.generateReply(input);
    expect(a).toBe(b);
  });

  it('clearly labels its output as synthetic, not a real AI response', async () => {
    const reply = await provider.generateReply({ systemPrompt: '', history: [], userMessage: 'Hi' });
    expect(reply).toContain('[mock-ai]');
  });

  it('responds differently to questions vs statements', async () => {
    const question = await provider.generateReply({ systemPrompt: '', history: [], userMessage: 'What time is it?' });
    const statement = await provider.generateReply({ systemPrompt: '', history: [], userMessage: 'It is raining.' });
    expect(question).not.toBe(statement);
    expect(question).toContain('question');
  });

  it('truncates very long messages in the echoed preview', async () => {
    const long = 'a'.repeat(200);
    const reply = await provider.generateReply({ systemPrompt: '', history: [], userMessage: long });
    expect(reply.length).toBeLessThan(long.length);
  });
});
