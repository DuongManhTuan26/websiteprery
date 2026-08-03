import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ businessName: '', name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function update(field) {
    return e => setForm({ ...form, [field]: e.target.value });
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Dùng thử miễn phí</h1>
        <input placeholder="Tên doanh nghiệp" value={form.businessName} onChange={update('businessName')} required />
        <input placeholder="Họ tên của bạn" value={form.name} onChange={update('name')} required />
        <input type="email" placeholder="Email" value={form.email} onChange={update('email')} required />
        <input type="password" placeholder="Mật khẩu (tối thiểu 8 ký tự)" value={form.password} onChange={update('password')} minLength={8} required />
        {error && <p className="form-error">{error}</p>}
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
        </button>
        <p>Đã có tài khoản? <Link to="/dang-nhap">Đăng nhập</Link></p>
      </form>
    </div>
  );
}
