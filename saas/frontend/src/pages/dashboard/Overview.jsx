import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export function Overview() {
  const [summary, setSummary] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(null);
  const [billingError, setBillingError] = useState(null);
  const [billingBusy, setBillingBusy] = useState(false);

  useEffect(() => {
    api('/dashboard/summary').then(setSummary).catch(err => setError(err.message));
    api('/dashboard/subscription').then(setSubscription).catch(() => {});
    api('/dashboard/plans').then(setPlans).catch(() => {});
  }, []);

  async function goToCheckout(planName) {
    setBillingError(null);
    setBillingBusy(true);
    try {
      const { url } = await api('/billing/checkout', { method: 'POST', body: { planName } });
      window.location.href = url;
    } catch (err) {
      setBillingError(err.message);
      setBillingBusy(false);
    }
  }

  async function goToPortal() {
    setBillingError(null);
    setBillingBusy(true);
    try {
      const { url } = await api('/billing/portal', { method: 'POST' });
      window.location.href = url;
    } catch (err) {
      setBillingError(err.message);
      setBillingBusy(false);
    }
  }

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

          {billingError && <p className="form-error" style={{ marginTop: '0.75rem' }}>{billingError}</p>}

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {plans?.filter(p => p.name !== subscription.plan).map(p => (
              <button
                key={p.name}
                className="btn btn-primary"
                disabled={billingBusy || !p.checkoutAvailable}
                onClick={() => goToCheckout(p.name)}
                title={p.checkoutAvailable ? '' : 'Chưa cấu hình thanh toán cho gói này'}
              >
                Nâng cấp lên {p.name} ({Number(p.priceMonthly).toLocaleString('vi-VN')} đ/tháng)
              </button>
            ))}
            {subscription.hasBillingAccount && (
              <button className="btn btn-ghost" disabled={billingBusy} onClick={goToPortal}>
                Quản lý thanh toán
              </button>
            )}
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
