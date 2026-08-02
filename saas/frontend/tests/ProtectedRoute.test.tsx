import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '../src/components/ProtectedRoute';
import { AuthProvider } from '../src/context/AuthContext';
import { api } from '../src/lib/api';

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/api')>('../src/lib/api');
  return { ...actual, api: { ...actual.api, me: vi.fn() } };
});

function renderWithRoutes() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Secret dashboard content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no stored session', async () => {
    localStorage.clear();
    vi.mocked(api.me).mockRejectedValue(new Error('unauthorized'));

    renderWithRoutes();

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('renders the protected content once /auth/me resolves with a user', async () => {
    localStorage.setItem('saas.accessToken', 'fake-token');
    localStorage.setItem('saas.refreshToken', 'fake-refresh');
    vi.mocked(api.me).mockResolvedValue({ user: { id: '1', email: 'a@example.com', name: 'A' } });

    renderWithRoutes();

    expect(await screen.findByText('Secret dashboard content')).toBeInTheDocument();
  });
});
