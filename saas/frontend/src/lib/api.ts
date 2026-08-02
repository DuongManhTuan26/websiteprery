const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

const ACCESS_TOKEN_KEY = 'saas.accessToken';
const REFRESH_TOKEN_KEY = 'saas.refreshToken';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeTokens(tokens: { accessToken: string; refreshToken: string }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

// Fetch wrapper that: attaches the bearer token when `auth` is requested,
// and — on a single 401 — attempts one silent refresh-and-retry before
// giving up. This is the standard "transparent to the caller" pattern for
// short-lived access tokens backed by a rotating refresh token.
async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (options.auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (res.status === 401 && options.auth && !isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options, true);
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new ApiError(res.status, payload?.error?.code ?? 'unknown_error', payload?.error?.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const tokens = await res.json();
    storeTokens(tokens);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResult {
  user: User;
  tokens: { accessToken: string; refreshToken: string };
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<AuthResult>('/auth/register', { method: 'POST', body: { email, password, name } }),

  login: (email: string, password: string) =>
    request<AuthResult>('/auth/login', { method: 'POST', body: { email, password } }),

  logout: async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await request('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
    }
    clearTokens();
  },

  me: () => request<{ user: User }>('/auth/me', { auth: true })
};
