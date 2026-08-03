import { Link } from 'react-router-dom';

// Real preny.ai nav labels (see /normalize/output/dom.json at the repo
// root for the captured hrefs: /, /huong-dan, /tinh-nang, /bao-gia-dich-vu,
// /tuyen-dung). Only "Trang chủ" and "Bảng giá" point at a real page here —
// "Tính năng" anchors to this same page's feature sections (also real,
// observed content). "Hướng dẫn"/"Tuyển dụng" are omitted rather than
// linked to fabricated content: this repo's capture only recorded the
// homepage, not those subpages' real body content.
const NAV = [
  { href: '/', label: 'Trang chủ' },
  { href: '/#hero', label: 'Tính năng' },
  { href: '/bao-gia-dich-vu', label: 'Bảng giá' }
];

export function SiteHeader() {
  return (
    <header className="site-header container">
      <Link to="/" className="logo"><strong>Preny Clone</strong></Link>
      <nav>
        <ul className="site-nav">
          {NAV.map(item => (
            <li key={item.label}><Link to={item.href}>{item.label}</Link></li>
          ))}
        </ul>
      </nav>
      <div className="header-actions">
        <Link to="/dang-nhap" className="btn btn-ghost">Đăng nhập</Link>
        <Link to="/dang-ky" className="btn">Đăng ký</Link>
      </div>
    </header>
  );
}
