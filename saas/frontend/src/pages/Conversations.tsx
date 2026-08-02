import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { api, ApiError, type Contact, type ConversationDetail, type ConversationSummary } from '../lib/api';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString();
}

function ContactLinker({
  workspaceId,
  conversation,
  onChanged
}: {
  workspaceId: string;
  conversation: ConversationDetail;
  onChanged: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    api.listContacts(workspaceId).then(res => setContacts(res.contacts));
  }, [workspaceId]);

  async function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const contactId = e.target.value || null;
    await api.setConversationContact(workspaceId, conversation.id, contactId);
    onChanged();
  }

  return (
    <label className="contact-linker">
      Linked contact
      <select value={conversation.contact?.id ?? ''} onChange={handleChange}>
        <option value="">— none —</option>
        {contacts.map(c => (
          <option key={c.id} value={c.id}>
            {c.name ?? c.email ?? c.id}
          </option>
        ))}
      </select>
    </label>
  );
}

function ConversationThread({
  workspaceId,
  conversationId,
  onContactChanged
}: {
  workspaceId: string;
  conversationId: string;
  onContactChanged: () => void;
}) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getConversation(workspaceId, conversationId)
      .then(res => setDetail(res.conversation))
      .catch(err => setError(err instanceof ApiError ? err.message : 'Failed to load conversation'));
  }, [workspaceId, conversationId]);

  useEffect(() => {
    setDetail(null);
    setError(null);
    load();
  }, [load]);

  function handleContactChanged() {
    load();
    onContactChanged();
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!detail) return <p>Loading…</p>;

  return (
    <div>
      <h2>{detail.chatbot.name}</h2>
      <p className="conversation-meta">
        {detail.channel} · started {formatTime(detail.createdAt)}
      </p>
      <ContactLinker workspaceId={workspaceId} conversation={detail} onChanged={handleContactChanged} />
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

  const refreshList = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const { conversations: list } = await api.listConversations(workspaceId);
      setConversations(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load conversations');
    }
  }, [workspaceId]);

  useEffect(() => {
    setLoading(true);
    refreshList().finally(() => setLoading(false));
  }, [refreshList]);

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
                  {c.contact && <span className="conversation-contact">{c.contact.name ?? c.contact.email}</span>}
                  <span className="conversation-preview">{c.lastMessage?.content ?? '(no messages)'}</span>
                  <span className="conversation-time">{formatTime(c.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="conversation-detail">
            {selectedId ? (
              <ConversationThread workspaceId={workspaceId} conversationId={selectedId} onContactChanged={refreshList} />
            ) : (
              <p>Select a conversation to view the full thread.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
