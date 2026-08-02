import { WidgetApi, WidgetApiError, type HistoryEntry } from './api.js';
import { WIDGET_STYLES } from './styles.js';

const DEFAULT_API_URL = 'http://localhost:4000';
const MAX_HISTORY_SENT = 20;

interface WidgetOptions {
  token: string;
  apiUrl?: string;
}

function readOptionsFromScriptTag(): WidgetOptions | null {
  const script = document.currentScript as HTMLScriptElement | null;
  const token = script?.dataset.token;
  if (!token) return null;

  return { token, apiUrl: script?.dataset.apiUrl || undefined };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

class SaasChatWidget {
  private api: WidgetApi;
  private history: HistoryEntry[] = [];
  private root: ShadowRoot;
  private bubble: HTMLButtonElement;
  private panel: HTMLDivElement;
  private messagesEl: HTMLDivElement;
  private input: HTMLInputElement;
  private sendButton: HTMLButtonElement;
  private open = false;

  constructor(options: WidgetOptions) {
    this.api = new WidgetApi(options.apiUrl ?? DEFAULT_API_URL, options.token);

    const host = document.createElement('div');
    document.body.appendChild(host);
    this.root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = WIDGET_STYLES;
    this.root.appendChild(style);

    this.bubble = el('button', { class: 'saas-widget-bubble', 'aria-label': 'Open chat' });
    this.bubble.textContent = '💬';
    this.bubble.addEventListener('click', () => this.toggle());
    this.root.appendChild(this.bubble);

    this.panel = el('div', { class: 'saas-widget-panel' });
    this.panel.hidden = true;

    const header = el('div', { class: 'saas-widget-header' });
    header.textContent = 'Chat';

    this.messagesEl = el('div', { class: 'saas-widget-messages' });

    const form = el('form', { class: 'saas-widget-form' });
    this.input = el('input', { class: 'saas-widget-input', placeholder: 'Type a message…', autocomplete: 'off' });
    this.sendButton = el('button', { class: 'saas-widget-send', type: 'submit' });
    this.sendButton.textContent = 'Send';
    form.appendChild(this.input);
    form.appendChild(this.sendButton);
    form.addEventListener('submit', e => {
      e.preventDefault();
      this.handleSend();
    });

    this.panel.appendChild(header);
    this.panel.appendChild(this.messagesEl);
    this.panel.appendChild(form);
    this.root.appendChild(this.panel);

    this.loadConfig(header);
  }

  private async loadConfig(header: HTMLDivElement) {
    try {
      const config = await this.api.getConfig();
      header.textContent = config.name;
      if (!config.isActive) {
        this.addMessage('assistant', 'This chatbot is currently offline.');
        this.sendButton.disabled = true;
      }
    } catch {
      header.textContent = 'Chat';
    }
  }

  private toggle() {
    this.open = !this.open;
    this.panel.hidden = !this.open;
    if (this.open) this.input.focus();
  }

  private addMessage(role: 'user' | 'assistant' | 'error', content: string) {
    const msg = el('div', { class: `saas-widget-msg ${role}` });
    msg.textContent = content;
    this.messagesEl.appendChild(msg);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private async handleSend() {
    const message = this.input.value.trim();
    if (!message) return;

    this.input.value = '';
    this.addMessage('user', message);
    this.history.push({ role: 'user', content: message });
    this.sendButton.disabled = true;

    try {
      const reply = await this.api.sendMessage(message, this.history.slice(-MAX_HISTORY_SENT));
      this.addMessage('assistant', reply);
      this.history.push({ role: 'assistant', content: reply });
    } catch (err) {
      const text = err instanceof WidgetApiError ? err.message : 'Something went wrong. Please try again.';
      this.addMessage('error', text);
    } finally {
      this.sendButton.disabled = false;
    }
  }
}

const options = readOptionsFromScriptTag();

if (!options) {
  console.error('[saas-widget] Missing data-token attribute on the widget <script> tag — widget not initialized.');
} else {
  // Defer to make sure document.body exists even if the script tag is in <head>.
  if (document.body) {
    new SaasChatWidget(options);
  } else {
    document.addEventListener('DOMContentLoaded', () => new SaasChatWidget(options));
  }
}
