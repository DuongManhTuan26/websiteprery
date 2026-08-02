import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Workspace } from '../lib/api';
import { useAuth } from './AuthContext';

const CURRENT_WORKSPACE_KEY = 'saas.currentWorkspaceId';

interface WorkspaceContextValue {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  selectWorkspace: (id: string) => void;
  createWorkspace: (name: string) => Promise<Workspace>;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(() => localStorage.getItem(CURRENT_WORKSPACE_KEY));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { workspaces: list } = await api.listWorkspaces();
      setWorkspaces(list);

      setCurrentId(prev => {
        const stillValid = prev && list.some(w => w.id === prev);
        const next = stillValid ? prev : (list[0]?.id ?? null);
        if (next) localStorage.setItem(CURRENT_WORKSPACE_KEY, next);
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectWorkspace = useCallback((id: string) => {
    setCurrentId(id);
    localStorage.setItem(CURRENT_WORKSPACE_KEY, id);
  }, []);

  const createWorkspace = useCallback(async (name: string) => {
    const { workspace } = await api.createWorkspace(name);
    await refresh();
    selectWorkspace(workspace.id);
    return workspace;
  }, [refresh, selectWorkspace]);

  const currentWorkspace = workspaces.find(w => w.id === currentId) ?? null;

  return (
    <WorkspaceContext.Provider value={{ workspaces, currentWorkspace, loading, selectWorkspace, createWorkspace, refresh }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
