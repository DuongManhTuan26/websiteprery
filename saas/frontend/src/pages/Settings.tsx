import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { api, ApiError, type ApiKeyStatus, type WorkspaceMemberEntry, type WorkspaceRole } from '../lib/api';

function WorkspaceProfileSection({ workspaceId, name, onRenamed }: { workspaceId: string; name: string; onRenamed: () => void }) {
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(name), [name]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateWorkspace(workspaceId, value);
      onRenamed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-section">
      <h2>Workspace</h2>
      <form className="inline-form" onSubmit={handleSubmit}>
        <input value={value} onChange={e => setValue(e.target.value)} required />
        <button type="submit" disabled={saving || value === name}>
          {saving ? 'Saving…' : 'Rename'}
        </button>
      </form>
    </section>
  );
}

function MembersSection({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = useState<WorkspaceMemberEntry[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(() => {
    api.listMembers(workspaceId).then(res => setMembers(res.members));
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      await api.addMember(workspaceId, email, 'MEMBER');
      setEmail('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add member');
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId: string, role: WorkspaceRole) {
    try {
      await api.updateMemberRole(workspaceId, userId, role);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update role');
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm('Remove this member from the workspace?')) return;
    try {
      await api.removeMember(workspaceId, userId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove member');
    }
  }

  return (
    <section className="settings-section">
      <h2>Members</h2>
      <form className="inline-form" onSubmit={handleInvite}>
        <input
          type="email"
          placeholder="Email of an existing account"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <button type="submit" disabled={inviting}>
          {inviting ? 'Adding…' : 'Add member'}
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.userId}>
              <td>{m.user.name}</td>
              <td>{m.user.email}</td>
              <td>
                <select value={m.role} onChange={e => handleRoleChange(m.userId, e.target.value as WorkspaceRole)}>
                  <option value="OWNER">Owner</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                </select>
              </td>
              <td>
                <button className="link-button" onClick={() => handleRemove(m.userId)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ApiKeysSection({ workspaceId }: { workspaceId: string }) {
  const [keys, setKeys] = useState<ApiKeyStatus[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.listApiKeys(workspaceId).then(res => setKeys(res.apiKeys));
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(provider: string) {
    const value = inputs[provider];
    if (!value) return;
    setError(null);
    try {
      await api.setApiKey(workspaceId, provider, value);
      setInputs(prev => ({ ...prev, [provider]: '' }));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save key');
    }
  }

  async function handleRemove(provider: string) {
    if (!confirm(`Remove the ${provider} API key?`)) return;
    await api.deleteApiKey(workspaceId, provider);
    load();
  }

  return (
    <section className="settings-section">
      <h2>AI provider API keys</h2>
      <p className="settings-hint">
        Keys are encrypted at rest and never shown again after saving. A chatbot set to a given provider needs a key
        configured here before it can generate real replies.
      </p>
      {error && <p className="error-text">{error}</p>}
      {keys.map(k => (
        <div key={k.provider} className="api-key-row">
          <strong>{k.provider}</strong>
          <span className={k.configured ? 'api-key-status configured' : 'api-key-status'}>
            {k.configured ? `Configured${k.updatedAt ? ` (updated ${new Date(k.updatedAt).toLocaleDateString()})` : ''}` : 'Not configured'}
          </span>
          <input
            type="password"
            placeholder={k.configured ? 'Replace key…' : 'Enter API key…'}
            value={inputs[k.provider] ?? ''}
            onChange={e => setInputs(prev => ({ ...prev, [k.provider]: e.target.value }))}
          />
          <button type="button" onClick={() => handleSave(k.provider)}>
            Save
          </button>
          {k.configured && (
            <button type="button" className="link-button" onClick={() => handleRemove(k.provider)}>
              Remove
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

export function SettingsPage() {
  const { currentWorkspace, refresh } = useWorkspace();

  if (!currentWorkspace) return null;

  return (
    <div>
      <h1>Settings</h1>
      <WorkspaceProfileSection workspaceId={currentWorkspace.id} name={currentWorkspace.name} onRenamed={refresh} />
      <MembersSection workspaceId={currentWorkspace.id} />
      <ApiKeysSection workspaceId={currentWorkspace.id} />
    </div>
  );
}
