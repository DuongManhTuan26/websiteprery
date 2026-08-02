import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { api, ApiError, type Contact, type ContactDetail } from '../lib/api';

function ContactDetailPanel({ workspaceId, contact, onChanged }: { workspaceId: string; contact: Contact; onChanged: () => void }) {
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [notes, setNotes] = useState(contact.notes ?? '');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.getContact(workspaceId, contact.id).then(res => {
      setDetail(res.contact);
      setNotes(res.contact.notes ?? '');
    });
  }, [workspaceId, contact.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveNotes() {
    setSaving(true);
    try {
      await api.updateContact(workspaceId, contact.id, { notes });
      onChanged();
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="test-reply-row">
      <td colSpan={5}>
        <div className="contact-detail-grid">
          <div>
            <label>
              Notes
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
            </label>
            <button type="button" onClick={handleSaveNotes} disabled={saving}>
              {saving ? 'Saving…' : 'Save notes'}
            </button>
          </div>
          <div>
            <strong>Linked conversations</strong>
            {!detail ? (
              <p>Loading…</p>
            ) : detail.conversations.length === 0 ? (
              <p>No conversations linked yet.</p>
            ) : (
              <ul className="linked-conversations">
                {detail.conversations.map(c => (
                  <li key={c.id}>
                    {c.chatbot.name} — {c.lastMessage?.content ?? '(no messages)'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export function ContactsPage() {
  const { currentWorkspace } = useWorkspace();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const workspaceId = currentWorkspace?.id;

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { contacts: list } = await api.listContacts(workspaceId);
      setContacts(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    setCreating(true);
    setError(null);
    try {
      await api.createContact(workspaceId, { name: name || undefined, email: email || undefined });
      setName('');
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create contact');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(contact: Contact) {
    if (!workspaceId) return;
    if (!confirm(`Delete contact "${contact.name ?? contact.email ?? contact.id}"?`)) return;
    await api.deleteContact(workspaceId, contact.id);
    await load();
  }

  if (!currentWorkspace || !workspaceId) return null;

  return (
    <div>
      <h1>Contacts</h1>

      <form className="inline-form" onSubmit={handleCreate}>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <button type="submit" disabled={creating}>
          {creating ? 'Adding…' : 'Add contact'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : contacts.length === 0 ? (
        <p>No contacts yet — add one above, or link one from a conversation.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Tags</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <Fragment key={c.id}>
                <tr>
                  <td>{c.name ?? '—'}</td>
                  <td>{c.email ?? '—'}</td>
                  <td>{c.phone ?? '—'}</td>
                  <td>{c.tags.join(', ') || '—'}</td>
                  <td className="row-actions">
                    <button className="link-button" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                      {expandedId === c.id ? 'Hide' : 'View'}
                    </button>
                    <button className="link-button" onClick={() => handleDelete(c)}>
                      Delete
                    </button>
                  </td>
                </tr>
                {expandedId === c.id && <ContactDetailPanel workspaceId={workspaceId} contact={c} onChanged={load} />}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
