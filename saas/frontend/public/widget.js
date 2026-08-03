(function () {
  var script = document.currentScript;
  var widgetKey = script.getAttribute('data-widget-key');
  var apiBase = script.getAttribute('data-api-base') || window.location.origin;

  if (!widgetKey) {
    console.error('[preny-clone widget] missing data-widget-key attribute');
    return;
  }

  var conversationId = null;

  var launcher = document.createElement('button');
  launcher.textContent = '💬';
  launcher.setAttribute('aria-label', 'Mở khung chat');
  Object.assign(launcher.style, {
    position: 'fixed', bottom: '20px', right: '20px', width: '56px', height: '56px',
    borderRadius: '50%', border: 'none', background: 'rgb(94,31,183)', color: '#fff',
    fontSize: '24px', cursor: 'pointer', zIndex: 999999, boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
  });

  var panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', bottom: '86px', right: '20px', width: '320px', height: '440px',
    background: '#fff', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
    display: 'none', flexDirection: 'column', overflow: 'hidden', zIndex: 999999,
    fontFamily: 'system-ui, sans-serif'
  });

  var messagesEl = document.createElement('div');
  Object.assign(messagesEl.style, { flex: '1', overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' });

  var formEl = document.createElement('form');
  Object.assign(formEl.style, { display: 'flex', borderTop: '1px solid #eee' });

  var imageLabel = document.createElement('label');
  imageLabel.textContent = '📷';
  Object.assign(imageLabel.style, { display: 'flex', alignItems: 'center', padding: '0 10px', cursor: 'pointer' });
  var imageInput = document.createElement('input');
  imageInput.type = 'file';
  imageInput.accept = 'image/*';
  imageInput.style.display = 'none';
  imageLabel.appendChild(imageInput);

  var inputEl = document.createElement('input');
  inputEl.placeholder = 'Nhắn tin...';
  Object.assign(inputEl.style, { flex: '1', border: 'none', padding: '12px', fontSize: '14px', outline: 'none' });
  var sendBtn = document.createElement('button');
  sendBtn.textContent = 'Gửi';
  sendBtn.type = 'submit';
  Object.assign(sendBtn.style, { border: 'none', background: 'rgb(94,31,183)', color: '#fff', padding: '0 16px', cursor: 'pointer' });
  formEl.appendChild(imageLabel);
  formEl.appendChild(inputEl);
  formEl.appendChild(sendBtn);

  panel.appendChild(messagesEl);
  panel.appendChild(formEl);

  function addBubble(text, sender) {
    var bubble = document.createElement('div');
    bubble.textContent = text;
    var isCustomer = sender === 'CUSTOMER';
    Object.assign(bubble.style, {
      alignSelf: isCustomer ? 'flex-end' : 'flex-start',
      background: isCustomer ? '#eee' : 'rgb(94,31,183)',
      color: isCustomer ? '#111' : '#fff',
      padding: '8px 12px', borderRadius: '10px', maxWidth: '80%', fontSize: '14px'
    });
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function ensureConversation() {
    if (conversationId) return conversationId;

    var res = await fetch(apiBase + '/api/widget/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetKey: widgetKey })
    });

    var data = await res.json();
    conversationId = data.conversationId;
    return conversationId;
  }

  formEl.addEventListener('submit', async function (e) {
    e.preventDefault();
    var text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = '';
    addBubble(text, 'CUSTOMER');

    var id = await ensureConversation();

    var res = await fetch(apiBase + '/api/widget/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetKey: widgetKey, conversationId: id, text: text })
    });

    var data = await res.json();

    if (data.botReply) {
      addBubble(data.botReply.content, 'BOT');
    }
  });

  imageInput.addEventListener('change', async function () {
    var file = imageInput.files[0];
    imageInput.value = '';
    if (!file) return;

    var id = await ensureConversation();

    var formData = new FormData();
    formData.append('file', file);
    var uploadRes = await fetch(apiBase + '/api/uploads/widget', { method: 'POST', body: formData });
    var uploadData = await uploadRes.json();

    var img = document.createElement('img');
    img.src = apiBase + uploadData.url;
    Object.assign(img.style, { maxWidth: '70%', borderRadius: '8px', alignSelf: 'flex-end' });
    messagesEl.appendChild(img);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    var res = await fetch(apiBase + '/api/widget/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetKey: widgetKey, conversationId: id, imageUrl: uploadData.url })
    });

    var data = await res.json();

    if (data.botReply) {
      addBubble(data.botReply.content, 'BOT');
    }
  });

  launcher.addEventListener('click', function () {
    panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
  });

  document.body.appendChild(launcher);
  document.body.appendChild(panel);
})();
