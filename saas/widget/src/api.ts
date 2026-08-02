export interface WidgetConfig {
  name: string;
  isActive: boolean;
}

export interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
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

  async sendMessage(message: string, history: HistoryEntry[]): Promise<string> {
    const res = await this.request<{ reply: string }>('POST', `/widget/${this.token}/message`, { message, history });
    return res.reply;
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
