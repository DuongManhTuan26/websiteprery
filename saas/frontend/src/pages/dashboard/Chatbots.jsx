import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const WIDGET_SNIPPET = (widgetKey) => `<script src="https://your-domain.example/widget.js" data-widget-key="${widgetKey}"></script>`;

export function Chatbots() {
  const [chatbots, setChatbots] = useState([]);
  const [form, setForm] = useState({ name: '', systemPrompt: '' });
  const [error, setError] = useState(null);

  function reload() {
    api('/chatbots').then(setChatbots).catch(() => {});
  }

  useEffect(reload, []);

  async function createChatbot(e) {
    e.preventDefault();
    setError(null);

    try {
      await api('/chatbots', { method: 'POST', body: form });
      setForm({ name: '', systemPrompt: '' });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleStatus(bot) {
    await api(`/chatbots/${bot.id}`, {
      method: 'PATCH',
      body: { status: bot.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }
    });
    reload();
  }

  return (
    <div>
      <h1>Chatbot</h1>

      <form className="inline-form" onSubmit={createChatbot}>
        <input
          placeholder="Tên chatbot"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          required
        />
        <textarea
          placeholder="Hướng dẫn hành vi cho AI (system prompt) — ví dụ: Bạn là trợ lý bán hàng của [tên shop]..."
          value={form.systemPrompt}
          onChange={e => setForm({ ...form, systemPrompt: e.target.value })}
          required
        />
        {error && <p className="form-error">{error}</p>}
        <button className="btn" type="submit">Tạo chatbot</button>
      </form>

      <div className="card-list">
        {chatbots.map(bot => (
          <div className="card" key={bot.id}>
            <div className="card-header">
              <strong>{bot.name}</strong>
              <span className={`badge badge-${bot.status.toLowerCase()}`}>{bot.status}</span>
            </div>
            <p className="muted">{bot.systemPrompt}</p>
            <div>
              <label>Mã nhúng widget:</label>
              <code>{WIDGET_SNIPPET(bot.widgetKey)}</code>
            </div>
            <button className="btn btn-ghost" onClick={() => toggleStatus(bot)}>
              {bot.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt'}
            </button>
          </div>
        ))}
        {chatbots.length === 0 && <p className="muted">Chưa có chatbot nào.</p>}
      </div>
    </div>
  );
}
