import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { api } from '../../api/client.js';

// Platform-operator page — deliberately outside /dashboard's per-tenant
// layout. Guarded twice: the backend rejects non-admins at the API level
// regardless (see admin.routes.js), this is just so a non-admin doesn't
// see a confusing 403-riddled page.
export function AdminLeads() {
  const { user, loading } = useAuth();
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      api('/admin/leads').then(setLeads).catch(err => setError(err.message));
    }
  }, [user]);

  if (loading) return <div className="loading-screen">Đang tải...</div>;
  if (!user) return <Navigate to="/dang-nhap" replace />;
  if (!user.isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  async function setStatus(id, status) {
    await api(`/admin/leads/${id}/status`, { method: 'PATCH', body: { status } });
    setLeads(await api('/admin/leads'));
  }

  return (
    <div className="dashboard-content" style={{ padding: '2rem' }}>
      <h1>Leads (yêu cầu dùng thử từ trang chủ)</h1>
      {error && <p className="form-error">{error}</p>}
      <table className="data-table">
        <thead>
          <tr><th>Họ tên</th><th>Username</th><th>Điện thoại</th><th>Danh mục</th><th>Nguồn</th><th>Trạng thái</th></tr>
        </thead>
        <tbody>
          {leads?.map(l => (
            <tr key={l.id}>
              <td>{l.fullName || '—'}</td>
              <td>{l.username || '—'}</td>
              <td>{l.phone || '—'}</td>
              <td>{l.category || '—'}</td>
              <td>{l.source}</td>
              <td>
                <select value={l.status} onChange={e => setStatus(l.id, e.target.value)}>
                  <option value="NEW">Mới</option>
                  <option value="CONTACTED">Đã liên hệ</option>
                  <option value="CONVERTED">Đã chuyển đổi</option>
                </select>
              </td>
            </tr>
          ))}
          {leads?.length === 0 && <tr><td colSpan={6} className="muted">Chưa có lead nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
