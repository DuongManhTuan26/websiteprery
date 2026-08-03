import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { SiteHeader } from '../components/SiteHeader.jsx';

// Real preny.ai has a "/bao-gia-dich-vu" nav item (see SiteHeader.jsx's
// comment on where that's observed from), but this repo's capture never
// recorded that subpage's real content — only the homepage was captured.
// The tiers/limits/prices below are this project's own original design
// (see backend/prisma/seed.js), not reverse-engineered from preny.ai's
// real, inaccessible pricing — same "originally designed, not copied"
// rule this project applies to every backend/business-logic decision.
export function Pricing() {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/plans').then(setPlans).catch(err => setError(err.message));
  }, []);

  return (
    <div className="marketing">
      <SiteHeader />

      <section className="hero" id="hero" style={{ paddingBottom: '2rem' }}>
        <div className="container">
          <p className="eyebrow">Bảng giá</p>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>Chọn gói phù hợp với quy mô bán hàng của bạn</h1>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          {error && <p className="form-error">{error}</p>}
          {!plans && !error && <p style={{ textAlign: 'center' }}>Đang tải...</p>}

          {plans && (
            <div className="pricing-grid">
              {plans.map(p => (
                <div className="pricing-card" key={p.name}>
                  <h3>{p.name}</h3>
                  <div className="pricing-price">
                    {Number(p.priceMonthly) === 0
                      ? 'Miễn phí'
                      : `${Number(p.priceMonthly).toLocaleString('vi-VN')} đ`}
                    {Number(p.priceMonthly) > 0 && <span className="pricing-period">/tháng</span>}
                  </div>
                  <ul className="pricing-features">
                    <li>{p.maxFanpages} Fanpage kết nối</li>
                    <li>{p.maxChatbots} Chatbot AI</li>
                    <li>{p.maxConversations.toLocaleString('vi-VN')} hội thoại/tháng</li>
                  </ul>
                  <Link to="/dang-ky" className="btn" style={{ width: '100%', textAlign: 'center' }}>
                    {Number(p.priceMonthly) === 0 ? 'Dùng thử miễn phí' : 'Bắt đầu dùng thử 14 ngày'}
                  </Link>
                </div>
              ))}
            </div>
          )}

          <p className="muted" style={{ textAlign: 'center', marginTop: '2rem' }}>
            Mọi gói đều bắt đầu với 14 ngày dùng thử miễn phí. Nâng cấp hoặc quản lý thanh toán trong Dashboard sau khi đăng ký.
          </p>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container">
          <p>Preny Clone — sản phẩm SaaS độc lập, lấy cảm hứng từ preny.ai</p>
        </div>
      </footer>
    </div>
  );
}
