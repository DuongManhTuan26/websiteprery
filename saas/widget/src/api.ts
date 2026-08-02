export interface WidgetConfig {
  name: string;
  isActive: boolean;
}

export interface SendMessageResult {
  reply: string;
  conversationId: string;
}

export class WidgetApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class WidgetApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  async getConfig(): Promise<WidgetConfig> {
    return this.request<WidgetConfig>('GET', `/widget/${this.token}/config`);
  }

  // conversationId is omitted on the first message; the server creates a
  // real, persisted conversation and returns its id, which the caller
  // should pass on every subsequent message so history is loaded from
  // storage rather than kept only in this tab's memory.
  async sendMessage(message: string, conversationId?: string): Promise<SendMessageResult> {
    return this.request<SendMessageResult>('POST', `/widget/${this.token}/message`, { message, conversationId });
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new WidgetApiError(res.status, payload?.error?.message ?? res.statusText);
    }

    return res.json() as Promise<T>;
  }
}
