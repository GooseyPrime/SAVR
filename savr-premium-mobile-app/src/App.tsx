/**
 * ⚠️ ROUTING RULES:
 * - Router is in main.tsx. Do NOT add another <BrowserRouter> here or anywhere.
 * - Use <Routes> + <Route> components ONLY. Do NOT use useRoutes().
 * - STATIC IMPORTS ONLY — no React.lazy() or dynamic import().
 * - Import from 'react-router' — NOT 'react-router-dom' (does not exist).
 */
import { Routes, Route, Navigate } from 'react-router';
import { useAppStore } from '@/store/app-store';

// Pages
import Splash from '@/pages/Splash';
import Onboarding from '@/pages/Onboarding';
import Auth from '@/pages/Auth';
import AuthCallback from '@/pages/AuthCallback';
import ResetPassword from '@/pages/ResetPassword';
import Home from '@/pages/Home';
import Pantry from '@/pages/Pantry';
import Recipes from '@/pages/Recipes';
import Plans from '@/pages/Plans';
import Profile from '@/pages/Profile';
import Chat from '@/pages/Chat';
import Settings from '@/pages/Settings';
import CookingMode from '@/pages/CookingMode';
import GroceryList from '@/pages/GroceryList';

/**
 * Route protection with proper state distinction:
 * - Unauthenticated visitor → redirect to onboarding
 * - Onboarding incomplete → redirect to onboarding
 * - Guest session (onboarding complete, not authenticated) → allow but with limitations
 * - Authenticated account → full access
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { preferences, isAuthenticated } = useAppStore();
  
  // If onboarding not completed, redirect to onboarding
  if (!preferences.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }
  
  // Guest mode: onboarding complete but not authenticated
  // Allow access but data is local-only
  // Authenticated: full access with cloud sync
  // Both can proceed, but UI should show guest limitations
  
  return <>{children}</>;
}

/**
 * Auth-only route - requires authenticated session, not just guest mode
 */
function AuthRequiredRoute({ children }: { children: React.ReactNode }) {
  const { preferences, isAuthenticated } = useAppStore();
  
  if (!preferences.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Splash Screen */}
      <Route path="/splash" element={<Splash />} />
      
      {/* Onboarding */}
      <Route path="/onboarding" element={<Onboarding />} />
      
      {/* Auth */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />
      
      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pantry"
        element={
          <ProtectedRoute>
            <Pantry />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recipes"
        element={
          <ProtectedRoute>
            <Recipes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/plans"
        element={
          <ProtectedRoute>
            <Plans />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cooking"
        element={
          <ProtectedRoute>
            <CookingMode />
          </ProtectedRoute>
        }
      />
      <Route
        path="/grocery"
        element={
          <ProtectedRoute>
            <GroceryList />
          </ProtectedRoute>
        }
      />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
