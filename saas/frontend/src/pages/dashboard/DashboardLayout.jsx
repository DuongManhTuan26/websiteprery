import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { SocketProvider } from '../../hooks/useSocket.jsx';

const LINKS = [
  { to: '/dashboard', label: 'Tổng quan', end: true },
  { to: '/dashboard/inbox', label: 'Hội thoại' },
  { to: '/dashboard/customers', label: 'Khách hàng (CRM)' },
  { to: '/dashboard/chatbots', label: 'Chatbot' },
  { to: '/dashboard/products', label: 'Sản phẩm' },
  { to: '/dashboard/fanpages', label: 'Fanpage' },
  { to: '/dashboard/orders', label: 'Đơn hàng' }
];

export function DashboardLayout() {
  const { user, logout } = useAuth();

  return (
    <SocketProvider>
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="dashboard-brand">Preny Clone</div>
          <nav>
            {LINKS.map(link => (
              <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => isActive ? 'active' : ''}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="dashboard-user">
            <div>{user?.name}</div>
            <button className="btn btn-ghost" onClick={logout}>Đăng xuất</button>
          </div>
        </aside>
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </SocketProvider>
  );
}
