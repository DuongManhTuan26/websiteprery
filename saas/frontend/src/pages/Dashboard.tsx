import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';

export function DashboardPage() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  return (
    <>
      <h1>Welcome, {user?.name}</h1>
      <p>
        Conversation, CRM, and settings screens are built out in their own phases and will appear in
        the sidebar above.
      </p>
      <dl className="account-info">
        <dt>Account email</dt>
        <dd>{user?.email}</dd>
        <dt>User ID</dt>
        <dd>{user?.id}</dd>
        <dt>Current workspace</dt>
        <dd>{currentWorkspace?.name}</dd>
        <dt>Your role</dt>
        <dd>{currentWorkspace?.role}</dd>
      </dl>
    </>
  );
}
