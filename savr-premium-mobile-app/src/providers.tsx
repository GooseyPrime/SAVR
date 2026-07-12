import { type ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';

/**
 * ⚠️ App-wide providers. Add new providers here — they'll be available in all routes.
 * Providers MUST wrap <BrowserRouter> to be accessible everywhere.
 */
export function AppProviders({ children }: { children: ReactNode }) {
	return <AuthProvider>{children}</AuthProvider>;
}
