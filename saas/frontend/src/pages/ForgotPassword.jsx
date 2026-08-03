import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Quên mật khẩu</h1>
        {submitted ? (
          <p>Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu — vui lòng kiểm tra hộp thư.</p>
        ) : (
          <>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            {error && <p className="form-error">{error}</p>}
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? 'Đang gửi...' : 'Gửi liên kết đặt lại mật khẩu'}
            </button>
          </>
        )}
        <p><Link to="/dang-nhap">Quay lại đăng nhập</Link></p>
      </form>
    </div>
  );
}
