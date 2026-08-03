import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export function Overview() {
  const [summary, setSummary] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/dashboard/summary').then(setSummary).catch(err => setError(err.message));
    api('/dashboard/subscription').then(setSubscription).catch(() => {});
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!summary) return <p>Đang tải...</p>;

  const cards = [
    { label: 'Tổng hội thoại', value: summary.totalConversations },
    { label: 'Bot đang xử lý', value: summary.botConversations },
    { label: 'Nhân viên đang xử lý', value: summary.humanConversations },
    { label: 'Khách hàng (CRM)', value: summary.totalCustomers },
    { label: 'Đơn xác nhận', value: summary.confirmedOrders },
    { label: 'Doanh thu xác nhận', value: `${Number(summary.confirmedRevenue).toLocaleString('vi-VN')} đ` },
    { label: 'Fanpage đã kết nối', value: summary.connectedFanpages }
  ];

  return (
    <div>
      <h1>Tổng quan</h1>

      {subscription?.plan && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <strong>Gói: {subscription.plan}</strong>
            <span className={`badge badge-${subscription.status.toLowerCase()}`}>{subscription.status}</span>
          </div>
          <p className="muted">Hết hạn: {new Date(subscription.currentPeriodEnd).toLocaleDateString('vi-VN')}</p>
          <div className="stat-grid" style={{ marginTop: '0.75rem' }}>
            <div>Fanpage: {subscription.usage.fanpages.used}/{subscription.usage.fanpages.limit}</div>
            <div>Chatbot: {subscription.usage.chatbots.used}/{subscription.usage.chatbots.limit}</div>
            <div>Hội thoại (kỳ này): {subscription.usage.conversationsThisPeriod.used}/{subscription.usage.conversationsThisPeriod.limit}</div>
          </div>
        </div>
      )}

      <div className="stat-grid">
        {cards.map(c => (
          <div className="stat-card" key={c.label}>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
