import { useState, type FormEvent } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, selectWorkspace, createWorkspace } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createWorkspace(name);
      setName('');
      setCreating(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="workspace-switcher">
      {!creating ? (
        <>
          <select
            aria-label="Current workspace"
            value={currentWorkspace?.id ?? ''}
            onChange={e => selectWorkspace(e.target.value)}
          >
            {workspaces.map(w => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button type="button" className="link-button" onClick={() => setCreating(true)}>
            + New workspace
          </button>
        </>
      ) : (
        <form onSubmit={handleCreate} className="workspace-create-form">
          <input
            autoFocus
            placeholder="Workspace name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <button type="submit" disabled={submitting}>
            Create
          </button>
          <button type="button" className="link-button" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
