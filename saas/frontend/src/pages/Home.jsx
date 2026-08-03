import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { SiteHeader } from '../components/SiteHeader.jsx';

// Copy below is the real content captured from https://preny.ai/ by this
// repo's capture-rebuild pipeline (see /ai-analysis/output/semantic.json
// and /analyzer/output/components.json at the repo root) — reproduced
// faithfully, not invented. Only the CTA destinations changed: they now
// point at this product's own real /dang-ky and /dang-nhap routes instead
// of the original site's.
const FEATURES = [
  {
    heading: 'Dữ liệu không chia sẻ',
    text: 'Dữ liệu không chia sẻ - không phụ thuộc nền tảng ngoài.'
  },
  {
    heading: 'Một giao diện duy nhất',
    text: 'Tập trung toàn bộ hội thoại bán hàng từ nhiều kênh vào một giao diện duy nhất. AI theo sát từng khách hàng, không bỏ sót cơ hội chốt đơn.'
  },
  {
    heading: 'Mini CRM tự động',
    text: 'Mọi thông tin khách hàng được tự động ghi nhận và đồng bộ vào mini CRM ngay trong lúc chat, giúp đội ngũ bán hàng theo sát khách hơn và tăng tỷ lệ chuyển đổi.'
  },
  {
    heading: 'Tư vấn bằng hình ảnh',
    text: 'AI Chatbot tư vấn sản phẩm trực quan qua hình ảnh hai chiều — khách gửi ảnh để AI tư vấn, và khách có thể yêu cầu AI gửi lại ảnh sản phẩm.'
  },
  {
    heading: 'Chuyển giao cho nhân viên',
    text: 'Chuyển đổi hội thoại từ Chatbot sang nhân viên hỗ trợ trực tiếp bất kỳ lúc nào, giữ nguyên toàn bộ lịch sử trò chuyện.'
  }
];

export function Home() {
  const [form, setForm] = useState({ fullName: '', username: '', phone: '', category: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    try {
      await api('/leads', { method: 'POST', body: form });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="marketing">
      <SiteHeader />

      <section className="hero" id="hero">
        <div className="container">
          <p className="eyebrow">Bộ giải pháp AI bán hàng thế hệ mới</p>
          <h1>AI bán hàng mạnh mẽ, giúp tăng hiệu quả chốt đơn lên đến 50%</h1>
          <Link to="/dang-ky" className="btn">Dùng thử miễn phí</Link>
        </div>
      </section>

      {FEATURES.map((f, i) => (
        <section className="section" key={i}>
          <div className="container">
            <h2>{f.heading}</h2>
            <p>{f.text}</p>
          </div>
        </section>
      ))}

      <section className="section" id="contact">
        <div className="container">
          <h2>Yêu cầu dùng thử</h2>
          {submitted ? (
            <p>Cảm ơn bạn — đội ngũ sẽ liên hệ sớm nhất.</p>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit}>
              <input
                className="form-field"
                placeholder="Họ tên"
                value={form.fullName}
                onChange={e => setForm({ ...form, fullName: e.target.value })}
              />
              <input
                className="form-field"
                placeholder="username"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
              />
              <input
                className="form-field"
                type="tel"
                placeholder="phone"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
              <input
                className="form-field"
                placeholder="category"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              />
              {error && <p className="form-error">{error}</p>}
              <button type="submit" className="btn">Gửi</button>
            </form>
          )}
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
