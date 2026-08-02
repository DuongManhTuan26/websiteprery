import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { api, ApiError, type Chatbot } from '../lib/api';

export function ChatbotsPage() {
  const { currentWorkspace } = useWorkspace();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
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

  if (!currentWorkspace) return null;

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
            </tr>
          </thead>
          <tbody>
            {chatbots.map(bot => (
              <tr key={bot.id}>
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
                <td>
                  <button className="link-button" onClick={() => handleDelete(bot)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
