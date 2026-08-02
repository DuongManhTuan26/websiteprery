import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Shared shell for every authenticated page. Nav items beyond "Overview"
// are placeholders wired up in later phases (Workspace, Chatbots,
// Conversations, CRM, Settings) — kept visible now so the information
// architecture is established from this phase onward rather than bolted on
// later.
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview', end: true },
  { to: '/dashboard/chatbots', label: 'Chatbots' },
  { to: '/dashboard/conversations', label: 'Conversations' },
  { to: '/dashboard/crm', label: 'Contacts' },
  { to: '/dashboard/settings', label: 'Settings' }
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand">SaaS Console</div>
        <nav>
          {NAV_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <span>{user?.name}</span>
          <button onClick={handleLogout}>Log out</button>
        </header>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
