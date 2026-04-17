import React, { ReactNode } from 'react';
import { AuthProvider } from './lib/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { HomeScreen } from './screens/HomeScreen';
import { DriverDashboard } from './screens/DriverDashboard';
import { AdminDashboard } from './screens/AdminDashboard';

const PrivateRoute = ({ children, roles }: { children: ReactNode, roles?: string[] }) => {
  const { user, profile, loading, isAuthReady } = useAuth();
  
  if (!isAuthReady || loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  const userRole = profile?.role || user?.role;
  if (roles && !roles.includes(userRole)) {
    return <Navigate to="/" />;
  }
  
  return <>{children}</>;
};

const RoleBasedHome = () => {
  const { user, profile } = useAuth();
  const role = profile?.role || user?.role;

  if (role === 'admin') return <AdminDashboard />;
  if (role === 'driver') return <DriverDashboard />;
  return <HomeScreen />;
};

const AppContent = () => {
  const { user, profile } = useAuth();
  const role = profile?.role || user?.role;
  const isAdmin = role === 'admin';

  return (
    <div className={isAdmin ? "w-full min-h-screen bg-slate-50" : "mobile-container"}>
      <Routes>
        <Route path="/welcome" element={<WelcomeScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignUpScreen />} />
        <Route path="/" element={
          <PrivateRoute>
            <RoleBasedHome />
          </PrivateRoute>
        } />
        <Route path="*" element={<Navigate to="/welcome" />} />
      </Routes>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
