import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../src/pages/Login';
import { AuthProvider } from '../src/context/AuthContext';
import { api } from '../src/lib/api';

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/api')>('../src/lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn().mockRejectedValue(new Error('no session')),
      login: vi.fn()
    }
  };
});

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  it('submits credentials and calls the login API', async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockResolvedValue({
      user: { id: '1', email: 'a@example.com', name: 'A' },
      tokens: { accessToken: 'access', refreshToken: 'refresh' }
    });

    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'a@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(api.login).toHaveBeenCalledWith('a@example.com', 'password123'));
  });

  it('shows an error message when login fails', async () => {
    const { ApiError } = await vi.importActual<typeof import('../src/lib/api')>('../src/lib/api');
    const user = userEvent.setup();
    vi.mocked(api.login).mockRejectedValue(new ApiError(401, 'unauthorized', 'Invalid email or password'));

    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'a@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });
});
