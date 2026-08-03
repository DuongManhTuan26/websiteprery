import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export function Fanpages() {
  const [fanpages, setFanpages] = useState([]);
  const [error, setError] = useState(null);

  function reload() {
    api('/fanpages').then(setFanpages).catch(() => {});
  }

  useEffect(reload, []);

  async function connect() {
    setError(null);

    try {
      const { url } = await api('/fanpages/connect/facebook');
      window.location.href = url;
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Fanpage</h1>
      <p className="muted">Kết nối Fanpage Facebook thật để chatbot trả lời tin nhắn Messenger tự động.</p>
      <button className="btn" onClick={connect}>Kết nối Fanpage Facebook</button>
      {error && <p className="form-error">{error}</p>}

      <table className="data-table">
        <thead><tr><th>Tên Page</th><th>Trạng thái</th><th>Kết nối lúc</th></tr></thead>
        <tbody>
          {fanpages.map(f => (
            <tr key={f.id}>
              <td>{f.pageName}</td>
              <td><span className={`badge badge-${f.status.toLowerCase()}`}>{f.status}</span></td>
              <td>{new Date(f.connectedAt).toLocaleString('vi-VN')}</td>
            </tr>
          ))}
          {fanpages.length === 0 && <tr><td colSpan={3} className="muted">Chưa kết nối Fanpage nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
