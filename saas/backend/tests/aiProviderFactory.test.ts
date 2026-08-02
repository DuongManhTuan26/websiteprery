import { describe, expect, it } from 'vitest';
import { getProvider } from '../src/modules/ai-providers/index.js';
import { MockAIProvider } from '../src/modules/ai-providers/mockProvider.js';
import { OpenAIProvider } from '../src/modules/ai-providers/openaiProvider.js';
import { ValidationError } from '../src/middleware/errorHandler.js';

describe('getProvider factory', () => {
  it('returns a MockAIProvider for MOCK', () => {
    expect(getProvider('MOCK')).toBeInstanceOf(MockAIProvider);
  });

  it('returns an OpenAIProvider for OPENAI when a key is given', () => {
    expect(getProvider('OPENAI', 'sk-test')).toBeInstanceOf(OpenAIProvider);
  });

  it('throws a clear error for OPENAI without a key, rather than silently using Mock', () => {
    expect(() => getProvider('OPENAI')).toThrow(ValidationError);
  });
});
