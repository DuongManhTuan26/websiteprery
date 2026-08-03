import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { SiteHeader } from '../components/SiteHeader.jsx';

// The real preny.ai homepage embeds its own live chat widget (a real
// "bot-embed.js" script observed in the capture — see
// normalize/output/dom.json at the repo root) so a visitor can try the
// product without signing up first. This does the same thing with a real
// (not fabricated) demo Chatbot this platform's own operators run — see
// prisma/seed.js and routes/demo.routes.js. If a fresh deployment hasn't
// run the seed yet, the endpoint 404s and this silently renders nothing
// extra rather than a broken script tag.
function useDemoWidget() {
  useEffect(() => {
    let cancelled = false;

    fetch('/api/demo/widget-key')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.widgetKey || document.querySelector('script[data-widget-key]')) {
          return;
        }

        const script = document.createElement('script');
        script.src = `${window.location.origin}/widget.js`;
        script.setAttribute('data-widget-key', data.widgetKey);
        script.setAttribute('data-api-base', window.location.origin);
        document.body.appendChild(script);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);
}

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

  useDemoWidget();

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

      {/*
        The real capture (ai-analysis/output/semantic.json) also recorded a
        "Hợp tác cùng các đơn vị báo chí uy tín" section on the source
        site, backed by real links to thanhnien.vn/24h.com.vn/cafef.vn/
        soha.vn articles — but those articles are real press coverage OF
        preny.ai specifically, not of this independent product. Reusing
        them here would misattribute that coverage to a site that never
        received it, which is a different failure mode than reproducing
        generic marketing copy (the feature descriptions above genuinely
        describe capabilities this product also has). Deliberately
        omitted rather than faithfully reproduced.
      */}

      <section className="section">
        <div className="container">
          <p className="eyebrow">Câu hỏi thường gặp</p>
          <h2>Khi nào cần chuyển đổi hội thoại từ Chatbot sang nhân viên hỗ trợ trực tiếp?</h2>
          <p>
            Bất kỳ lúc nào — trong Hộp thư đến (Inbox) của Dashboard, một nhân viên có thể chuyển trạng thái
            hội thoại sang "Nhân viên" ngay giữa cuộc trò chuyện. Ngay khi chuyển đổi, Chatbot AI sẽ ngừng
            tự động trả lời hội thoại đó — nhân viên tiếp quản hoàn toàn, giữ nguyên toàn bộ lịch sử trò chuyện
            trước đó — cho đến khi đóng hội thoại hoặc chuyển lại cho Chatbot.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">Cùng đội ngũ Preny Clone</p>
          <h2>Nhận tư vấn để tối ưu tương tác và tăng trưởng doanh nghiệp</h2>
          <p>Để lại thông tin bên dưới, đội ngũ sẽ liên hệ tư vấn miễn phí.</p>
          <a href="#contact" className="btn">Yêu cầu tư vấn</a>
        </div>
      </section>

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
