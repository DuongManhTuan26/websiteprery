let accessToken = null;
let onUnauthorized = () => {};

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function refreshAccessToken() {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  accessToken = data.accessToken;
  return accessToken;
}

// Every call goes through here so a single 401 (expired access token)
// transparently retries once after refreshing — callers never see the
// refresh dance, only a final success or a real failure.
export async function api(path, { method = 'GET', body, isFormData = false, _retried = false } = {}) {
  const headers = {};

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (body && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined
  });

  if (res.status === 401 && !_retried) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      return api(path, { method, body, isFormData, _retried: true });
    }

    onUnauthorized();
    throw new Error('Unauthorized');
  }

  if (res.status === 204) {
    return null;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }

  return data;
}
