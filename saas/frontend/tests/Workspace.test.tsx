import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/context/AuthContext';
import { WorkspaceProvider } from '../src/context/WorkspaceContext';
import { DashboardLayout } from '../src/components/DashboardLayout';
import { api } from '../src/lib/api';

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/api')>('../src/lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn().mockResolvedValue({ user: { id: 'u1', email: 'a@example.com', name: 'A' } }),
      listWorkspaces: vi.fn(),
      createWorkspace: vi.fn()
    }
  };
});

function renderLayout() {
  localStorage.setItem('saas.accessToken', 'fake');
  localStorage.setItem('saas.refreshToken', 'fake');

  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider>
        <WorkspaceProvider>
          <Routes>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<div>Dashboard body</div>} />
            </Route>
          </Routes>
        </WorkspaceProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('DashboardLayout + WorkspaceContext', () => {
  it('shows the create-workspace prompt when the user has none', async () => {
    vi.mocked(api.listWorkspaces).mockResolvedValue({ workspaces: [] });

    renderLayout();

    expect(await screen.findByText('Create your workspace')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard body')).not.toBeInTheDocument();
  });

  it('renders the dashboard shell once a workspace exists', async () => {
    vi.mocked(api.listWorkspaces).mockResolvedValue({
      workspaces: [{ id: 'w1', name: 'Acme', slug: 'acme-abc123', role: 'OWNER' }]
    });

    renderLayout();

    expect(await screen.findByText('Dashboard body')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Acme' })).toBeInTheDocument();
  });

  it('creates a workspace via the prompt and reveals the dashboard', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listWorkspaces).mockResolvedValueOnce({ workspaces: [] });
    vi.mocked(api.createWorkspace).mockResolvedValue({
      workspace: { id: 'w2', name: 'New Co', slug: 'new-co-xyz', role: 'OWNER' }
    });
    vi.mocked(api.listWorkspaces).mockResolvedValueOnce({
      workspaces: [{ id: 'w2', name: 'New Co', slug: 'new-co-xyz', role: 'OWNER' }]
    });

    renderLayout();

    const input = await screen.findByPlaceholderText('Acme Inc');
    await user.type(input, 'New Co');
    await user.click(screen.getByRole('button', { name: /create workspace/i }));

    expect(await screen.findByText('Dashboard body')).toBeInTheDocument();
  });
});
