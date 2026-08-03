import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export function Customers() {
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    api('/customers').then(setCustomers).catch(() => {});
  }, []);

  return (
    <div>
      <h1>Khách hàng (Mini CRM)</h1>
      <p className="muted">Được tự động tạo/cập nhật ngay khi có hội thoại mới — không cần nhập tay.</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Tên</th>
            <th>Điện thoại</th>
            <th>Email</th>
            <th>Facebook PSID</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {customers.map(c => (
            <tr key={c.id}>
              <td>{c.name || '—'}</td>
              <td>{c.phone || '—'}</td>
              <td>{c.email || '—'}</td>
              <td>{c.facebookPsid || '—'}</td>
              <td>{c.notes || '—'}</td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr><td colSpan={5} className="muted">Chưa có khách hàng nào.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
