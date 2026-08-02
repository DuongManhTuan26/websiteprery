import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { api, ApiError, type Chatbot } from '../lib/api';

function TestReplyPanel({ workspaceId, chatbot }: { workspaceId: string; chatbot: Chatbot }) {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setReply(null);
    try {
      const res = await api.testChatbotReply(workspaceId, chatbot.id, message);
      setReply(res.reply);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to get a reply');
    } finally {
      setSending(false);
    }
  }

  return (
    <tr className="test-reply-row">
      <td colSpan={6}>
        <form className="inline-form" onSubmit={handleSend}>
          <input
            placeholder={`Send a test message to "${chatbot.name}"`}
            value={message}
            onChange={e => setMessage(e.target.value)}
            required
          />
          <button type="submit" disabled={sending}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
        {reply && <p className="test-reply-output">{reply}</p>}
      </td>
    </tr>
  );
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

function EmbedCodePanel({ chatbot }: { chatbot: Chatbot }) {
  const snippet = `<script src="${API_URL}/widget.js" data-token="${chatbot.widgetToken}" data-api-url="${API_URL}"></script>`;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <tr className="test-reply-row">
      <td colSpan={6}>
        <p>Paste this before <code>&lt;/body&gt;</code> on any page to embed this chatbot:</p>
        <pre className="embed-snippet">{snippet}</pre>
        <button type="button" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy snippet'}
        </button>
      </td>
    </tr>
  );
}

export function ChatbotsPage() {
  const { currentWorkspace } = useWorkspace();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [testingBotId, setTestingBotId] = useState<string | null>(null);
  const [embedBotId, setEmbedBotId] = useState<string | null>(null);
  const workspaceId = currentWorkspace?.id;

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { chatbots: list } = await api.listChatbots(workspaceId);
      setChatbots(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load chatbots');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId || !newName.trim()) return;

    setCreating(true);
    setError(null);
    try {
      await api.createChatbot(workspaceId, { name: newName.trim() });
      setNewName('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create chatbot');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(bot: Chatbot) {
    if (!workspaceId) return;
    await api.updateChatbot(workspaceId, bot.id, { isActive: !bot.isActive });
    await load();
  }

  async function handleDelete(bot: Chatbot) {
    if (!workspaceId) return;
    if (!confirm(`Delete "${bot.name}"? This cannot be undone.`)) return;
    await api.deleteChatbot(workspaceId, bot.id);
    await load();
  }

  if (!currentWorkspace || !workspaceId) return null;

  return (
    <div>
      <h1>Chatbots</h1>

      <form className="inline-form" onSubmit={handleCreate}>
        <input placeholder="New chatbot name" value={newName} onChange={e => setNewName(e.target.value)} required />
        <button type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create chatbot'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : chatbots.length === 0 ? (
        <p>No chatbots yet — create one above.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Widget token</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {chatbots.map(bot => (
              <Fragment key={bot.id}>
                <tr>
                  <td>{bot.name}</td>
                  <td>{bot.aiProvider}</td>
                  <td>
                    <button className="link-button" onClick={() => handleToggleActive(bot)}>
                      {bot.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <code>{bot.widgetToken}</code>
                  </td>
                  <td className="row-actions">
                    <button className="link-button" onClick={() => setTestingBotId(testingBotId === bot.id ? null : bot.id)}>
                      {testingBotId === bot.id ? 'Hide test' : 'Test'}
                    </button>
                    <button className="link-button" onClick={() => setEmbedBotId(embedBotId === bot.id ? null : bot.id)}>
                      {embedBotId === bot.id ? 'Hide embed code' : 'Embed'}
                    </button>
                  </td>
                  <td>
                    <button className="link-button" onClick={() => handleDelete(bot)}>
                      Delete
                    </button>
                  </td>
                </tr>
                {testingBotId === bot.id && <TestReplyPanel workspaceId={workspaceId} chatbot={bot} />}
                {embedBotId === bot.id && <EmbedCodePanel chatbot={bot} />}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
