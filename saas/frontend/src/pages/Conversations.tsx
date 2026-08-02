import { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { api, ApiError, type ConversationDetail, type ConversationSummary } from '../lib/api';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString();
}

function ConversationThread({ workspaceId, conversationId }: { workspaceId: string; conversationId: string }) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setError(null);
    api
      .getConversation(workspaceId, conversationId)
      .then(res => setDetail(res.conversation))
      .catch(err => setError(err instanceof ApiError ? err.message : 'Failed to load conversation'));
  }, [workspaceId, conversationId]);

  if (error) return <p className="error-text">{error}</p>;
  if (!detail) return <p>Loading…</p>;

  return (
    <div>
      <h2>{detail.chatbot.name}</h2>
      <p className="conversation-meta">
        {detail.channel} · started {formatTime(detail.createdAt)}
      </p>
      <div className="conversation-thread">
        {detail.messages.map(m => (
          <div key={m.id} className={`saas-msg ${m.role === 'USER' ? 'user' : 'assistant'}`}>
            {m.content}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConversationsPage() {
  const { currentWorkspace } = useWorkspace();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const workspaceId = currentWorkspace?.id;

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { conversations: list } = await api.listConversations(workspaceId);
      setConversations(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!currentWorkspace || !workspaceId) return null;

  return (
    <div>
      <h1>Conversations</h1>
      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : conversations.length === 0 ? (
        <p>No conversations yet — messages sent through an embedded widget will show up here.</p>
      ) : (
        <div className="conversations-layout">
          <ul className="conversation-list">
            {conversations.map(c => (
              <li key={c.id}>
                <button
                  className={c.id === selectedId ? 'conversation-list-item active' : 'conversation-list-item'}
                  onClick={() => setSelectedId(c.id)}
                >
                  <strong>{c.chatbot.name}</strong>
                  <span className="conversation-preview">{c.lastMessage?.content ?? '(no messages)'}</span>
                  <span className="conversation-time">{formatTime(c.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="conversation-detail">
            {selectedId ? (
              <ConversationThread workspaceId={workspaceId} conversationId={selectedId} />
            ) : (
              <p>Select a conversation to view the full thread.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
