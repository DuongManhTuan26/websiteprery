import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export function Products() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', price: '' });
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState(null);

  function reload() {
    api('/products').then(setProducts).catch(() => {});
  }

  useEffect(reload, []);

  async function createProduct(e) {
    e.preventDefault();
    setError(null);

    try {
      let imageUrl;

      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        const uploaded = await api('/uploads', { method: 'POST', body: formData, isFormData: true });
        imageUrl = uploaded.url;
      }

      await api('/products', {
        method: 'POST',
        body: { ...form, price: form.price ? Number(form.price) : undefined, imageUrl }
      });

      setForm({ name: '', description: '', price: '' });
      setImageFile(null);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Danh mục sản phẩm</h1>
      <p className="muted">Chatbot AI tra cứu danh mục này khi khách yêu cầu xem ảnh sản phẩm.</p>

      <form className="inline-form" onSubmit={createProduct}>
        <input placeholder="Tên sản phẩm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <textarea placeholder="Mô tả" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <input placeholder="Giá (VNĐ)" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
        <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} />
        {error && <p className="form-error">{error}</p>}
        <button className="btn" type="submit">Thêm sản phẩm</button>
      </form>

      <div className="card-list">
        {products.map(p => (
          <div className="card" key={p.id}>
            {p.imageUrl && <img src={p.imageUrl} alt={p.name} style={{ maxWidth: '120px', borderRadius: '8px' }} />}
            <div className="card-header"><strong>{p.name}</strong></div>
            <p className="muted">{p.description}</p>
            {p.price != null && <p>{Number(p.price).toLocaleString('vi-VN')} đ</p>}
          </div>
        ))}
        {products.length === 0 && <p className="muted">Chưa có sản phẩm nào.</p>}
      </div>
    </div>
  );
}
