import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, SocketProvider } from './context';
import { Landing, Login, Register, Dashboard, Chat, Friends, Profile, NotFound } from './pages';
import { useAuthContext } from './context/AuthContext';
import Layout from './components/layout/Layout';

// Redirects to /login when not authenticated; shows nothing while loading
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthContext();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Inner component so it can call useAuthContext (must be inside AuthProvider)
const AppRoutes: React.FC = () => {
  const { user } = useAuthContext();

  return (
    <Routes>
      {/* ── Public routes ── */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* ── Protected routes wrapped in Layout ── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout user={user} currentRoute="/dashboard">
              <Dashboard user={user ?? undefined} />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/friends"
        element={
          <ProtectedRoute>
            <Layout user={user} currentRoute="/friends">
              <Friends />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout user={user} currentRoute="/profile">
              <Profile />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* ── Chat is full-screen — no Layout wrapper ── */}
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />

      {/* ── 404 ── */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;
