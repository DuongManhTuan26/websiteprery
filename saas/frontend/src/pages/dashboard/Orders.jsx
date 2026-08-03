import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export function Orders() {
  const [orders, setOrders] = useState([]);

  function reload() {
    api('/orders').then(setOrders).catch(() => {});
  }

  useEffect(reload, []);

  async function setStatus(id, status) {
    await api(`/orders/${id}/status`, { method: 'PATCH', body: { status } });
    reload();
  }

  return (
    <div>
      <h1>Đơn hàng</h1>
      <table className="data-table">
        <thead>
          <tr><th>Khách hàng</th><th>Sản phẩm</th><th>SL</th><th>Giá trị</th><th>Trạng thái</th></tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td>{o.customer?.name || o.customer?.phone || '—'}</td>
              <td>{o.productName}</td>
              <td>{o.quantity}</td>
              <td>{Number(o.amount).toLocaleString('vi-VN')} đ</td>
              <td>
                <select value={o.status} onChange={e => setStatus(o.id, e.target.value)}>
                  <option value="PENDING">Chờ xác nhận</option>
                  <option value="CONFIRMED">Đã xác nhận</option>
                  <option value="CANCELLED">Đã huỷ</option>
                </select>
              </td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={5} className="muted">Chưa có đơn hàng nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
