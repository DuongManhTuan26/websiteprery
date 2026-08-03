import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useSocket } from '../../hooks/useSocket.jsx';

export function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const { socket } = useSocket();

  const loadConversations = useCallback(() => {
    api('/conversations').then(setConversations).catch(() => {});
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!activeId) return;
    api(`/conversations/${activeId}/messages`).then(setMessages).catch(() => {});
  }, [activeId]);

  useEffect(() => {
    if (!socket) return;

    function onNewMessage(message) {
      if (message.conversationId === activeId) {
        setMessages(prev => [...prev, message]);
      }
      loadConversations();
    }

    function onStatusUpdate() {
      loadConversations();
    }

    socket.on('message:new', onNewMessage);
    socket.on('conversation:updated', onStatusUpdate);
    socket.on('bot:error', payload => console.warn('Bot error:', payload.message));

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('conversation:updated', onStatusUpdate);
    };
  }, [socket, activeId, loadConversations]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim() || !activeId) return;

    const message = await api(`/conversations/${activeId}/messages`, {
      method: 'POST',
      body: { content: draft }
    });

    setMessages(prev => [...prev, message]);
    setDraft('');
  }

  async function sendImage(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeId) return;

    const formData = new FormData();
    formData.append('file', file);
    const { url } = await api('/uploads', { method: 'POST', body: formData, isFormData: true });

    const message = await api(`/conversations/${activeId}/messages`, {
      method: 'POST',
      body: { contentType: 'IMAGE', imageUrl: url }
    });

    setMessages(prev => [...prev, message]);
  }

  async function setStatus(status) {
    await api(`/conversations/${activeId}/status`, { method: 'PATCH', body: { status } });
    loadConversations();
  }

  const active = conversations.find(c => c.id === activeId);

  return (
    <div className="inbox">
      <div className="inbox-list">
        <h2>Hội thoại</h2>
        {conversations.length === 0 && <p className="muted">Chưa có hội thoại nào. Nhúng widget hoặc kết nối Fanpage để bắt đầu nhận tin nhắn thật.</p>}
        {conversations.map(c => (
          <button
            key={c.id}
            className={`inbox-item ${c.id === activeId ? 'active' : ''}`}
            onClick={() => setActiveId(c.id)}
          >
            <div className="inbox-item-title">{c.customer?.name || c.customer?.phone || 'Khách chưa rõ danh tính'}</div>
            <div className="inbox-item-preview">{c.messages?.[0]?.content?.slice(0, 60) || '(hình ảnh)'}</div>
            <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
          </button>
        ))}
      </div>

      <div className="inbox-thread">
        {!active && <p className="muted">Chọn một hội thoại để xem chi tiết.</p>}

        {active && (
          <>
            <div className="inbox-thread-header">
              <div>{active.customer?.name || active.customer?.phone || 'Khách chưa rõ danh tính'} — kênh {active.channel}</div>
              <div className="inbox-actions">
                <button className="btn btn-ghost" onClick={() => setStatus('BOT')}>Giao lại cho Bot</button>
                <button className="btn btn-ghost" onClick={() => setStatus('HUMAN')}>Nhận xử lý</button>
                <button className="btn btn-ghost" onClick={() => setStatus('CLOSED')}>Đóng</button>
              </div>
            </div>

            <div className="inbox-messages">
              {messages.map(m => (
                <div key={m.id} className={`message message-${m.senderType.toLowerCase()}`}>
                  {m.contentType === 'IMAGE' && m.imageUrl
                    ? <img src={m.imageUrl} alt="" className="message-image" />
                    : <span>{m.content}</span>}
                </div>
              ))}
            </div>

            <form className="inbox-composer" onSubmit={sendMessage}>
              <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                📷
                <input type="file" accept="image/*" onChange={sendImage} style={{ display: 'none' }} />
              </label>
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Nhắn với tư cách nhân viên..."
              />
              <button className="btn" type="submit">Gửi</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
