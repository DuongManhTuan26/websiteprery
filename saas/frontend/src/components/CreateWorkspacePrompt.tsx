import { useState, type FormEvent } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ApiError } from '../lib/api';

// Shown when an authenticated user has zero workspaces — every account
// needs at least one tenant before anything else (chatbots, contacts, ...)
// makes sense to show.
export function CreateWorkspacePrompt() {
  const { createWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createWorkspace(name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create your workspace</h1>
        <p>A workspace is where your chatbots, conversations, and contacts live.</p>
        {error && <p className="error-text">{error}</p>}
        <label>
          Workspace name
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="Acme Inc" />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create workspace'}
        </button>
      </form>
    </div>
  );
}
