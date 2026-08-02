import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetApi, WidgetApiError } from '../src/api.js';

describe('WidgetApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches config from the correct URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: 'Bot', isActive: true }) });
    vi.stubGlobal('fetch', fetchMock);

    const api = new WidgetApi('https://api.example.com', 'tok123');
    const config = await api.getConfig();

    expect(config).toEqual({ name: 'Bot', isActive: true });
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/widget/tok123/config', expect.objectContaining({ method: 'GET' }));
  });

  it('sends a message with no conversationId on the first call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'Hello!', conversationId: 'c1' }) });
    vi.stubGlobal('fetch', fetchMock);

    const api = new WidgetApi('https://api.example.com', 'tok123');
    const result = await api.sendMessage('Hi');

    expect(result).toEqual({ reply: 'Hello!', conversationId: 'c1' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/widget/tok123/message');
    expect(JSON.parse(options.body)).toEqual({ message: 'Hi', conversationId: undefined });
  });

  it('sends the conversationId on subsequent calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'Again!', conversationId: 'c1' }) });
    vi.stubGlobal('fetch', fetchMock);

    const api = new WidgetApi('https://api.example.com', 'tok123');
    await api.sendMessage('Second message', 'c1');

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ message: 'Second message', conversationId: 'c1' });
  });

  it('throws WidgetApiError with the server message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: 'Unknown widget token' } })
    }));

    const api = new WidgetApi('https://api.example.com', 'bad-token');
    await expect(api.getConfig()).rejects.toBeInstanceOf(WidgetApiError);
    await expect(api.getConfig()).rejects.toThrow('Unknown widget token');
  });
});
