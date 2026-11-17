import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { UserAccount } from '../types';

interface AuthContextValue {
  demoAccounts: UserAccount[];
  activeDemoUser: UserAccount | null;
  loadingAuth: boolean;
  authError: string | null;
  selectDemoAccount: (account: UserAccount) => void;
  refreshDemoAccounts: () => Promise<void>;
  signOutDemo: () => void;
  getToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = 'beacon_demo_uid';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [demoAccounts, setDemoAccounts] = useState<UserAccount[]>([]);
  const [activeDemoUser, setActiveDemoUser] = useState<UserAccount | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setAuthError(null);
    try {
      const res = await fetch('/api/demo-accounts');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load demo accounts.');
      }
      const list = (data.accounts || []) as UserAccount[];
      setDemoAccounts(list);

      const savedUid = sessionStorage.getItem(SESSION_KEY);
      if (savedUid) {
        const matched = list.find((a) => a.uid === savedUid);
        if (matched) {
          setActiveDemoUser(matched);
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Unable to reach demo account directory.'
      );
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const selectDemoAccount = useCallback((account: UserAccount) => {
    setAuthError(null);
    sessionStorage.setItem(SESSION_KEY, account.uid);
    setActiveDemoUser(account);
  }, []);

  const signOutDemo = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setActiveDemoUser(null);
  }, []);

  const getToken = useCallback(async () => {
    if (!activeDemoUser) {
      throw new Error('No demo account selected. Please sign in.');
    }
    return activeDemoUser.uid;
  }, [activeDemoUser]);

  return (
    <AuthContext.Provider
      value={{
        demoAccounts,
        activeDemoUser,
        loadingAuth,
        authError,
        selectDemoAccount,
        refreshDemoAccounts: loadAccounts,
        signOutDemo,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
