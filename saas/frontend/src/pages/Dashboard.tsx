import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <h1>Welcome, {user?.name}</h1>
      <p>
        This is the authenticated dashboard shell (Phase 5). Workspace, chatbot, conversation, CRM, and
        settings screens are built out in their own phases and will appear in the sidebar above.
      </p>
      <dl className="account-info">
        <dt>Account email</dt>
        <dd>{user?.email}</dd>
        <dt>User ID</dt>
        <dd>{user?.id}</dd>
      </dl>
    </DashboardLayout>
  );
}
