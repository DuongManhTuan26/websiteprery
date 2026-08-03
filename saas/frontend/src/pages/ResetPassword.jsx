import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password } });
      setDone(true);
      setTimeout(() => navigate('/dang-nhap'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-form">
          <h1>Đặt lại mật khẩu</h1>
          <p className="form-error">Liên kết không hợp lệ — thiếu mã đặt lại mật khẩu.</p>
          <p><Link to="/quen-mat-khau">Yêu cầu liên kết mới</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Đặt lại mật khẩu</h1>
        {done ? (
          <p>Đặt lại mật khẩu thành công — đang chuyển đến trang đăng nhập...</p>
        ) : (
          <>
            <input
              type="password"
              placeholder="Mật khẩu mới"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              required
            />
            {error && <p className="form-error">{error}</p>}
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
