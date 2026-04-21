import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, SocketProvider } from './context';
import { Landing, Login, Register, Dashboard, Chat, Friends, Profile, NotFound } from './pages';
import { useAuthContext } from './context/AuthContext';
import { useSocketContext } from './context/SocketContext';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/common/LoadingSpinner';
import { useFriends } from './hooks/useFriends';
import { userAPI } from './services/api';

// ── Spinner while auth resolves, redirect if not authenticated ─────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthContext();
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#030712',
      }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// ── Inner component (needs BrowserRouter + AuthProvider in scope) ───────────
const AppRoutes: React.FC = () => {
  const { user, login, register, loginAsGuest, logout, updateUser, isLoading } = useAuthContext();

  // FIX: pull live online count from SocketContext for the Navbar
  const { onlineCount } = useSocketContext();

  const navigate = useNavigate();

  // ── Friend data — fetched once, shared across Dashboard / Friends / Sidebar ─
  const {
    friends,
    pendingRequests,
    onlineFriends,
    isLoading: friendsLoading,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
    blockUser,
  } = useFriends(user?.id);

  // ── Profile stats — fetched once when user is available ─────────────────
  const [userStats, setUserStats] = useState<{
    chatCount: number;
    friendCount: number;
  }>({ chatCount: 0, friendCount: 0 });

  useEffect(() => {
    if (!user?.id) return;
    userAPI.getUserStats()
      .then((body: any) => {
        // Backend: { success, data: { stats: { total_sessions, total_friends } } }
        const s = body?.data?.stats ?? body?.stats ?? {};
        setUserStats({
          chatCount:   Number(s.total_sessions  ?? 0),
          friendCount: Number(s.total_friends   ?? 0),
        });
      })
      .catch(() => { /* non-critical — stats stay at 0 */ });
  }, [user?.id]);

  // ── Profile update handler ────────────────────────────────────────────────
  const handleUpdateProfile = useCallback(async (data: { username?: string; bio?: string }) => {
    try {
      const res = await userAPI.updateProfile(data);
      // Sync the updated user into AuthContext so Navbar/Avatar refresh instantly
      const updated = res?.data?.user ?? res?.user ?? null;
      if (updated) updateUser(updated);
    } catch (err) {
      console.error('Profile update failed:', err);
    }
  }, [updateUser]);

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleLogin = async (credentials: { email: string; password: string }) => {
    try {
      await login(credentials);
      navigate('/dashboard');
    } catch { /* error surfaces in context.error */ }
  };

  const handleRegister = async (data: { username: string; email: string; password: string }) => {
    try {
      await register(data);
      navigate('/dashboard');
    } catch { /* error surfaces in context.error */ }
  };

  const handleGuestLogin = async () => {
    try {
      await loginAsGuest();
      navigate('/dashboard');
    } catch { /* error surfaces in context.error */ }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // ── Shared Layout props (avoids repetition across routes) ─────────────────
  const sharedLayoutProps = {
    user,
    friends,                   // FIX: sidebar shows online friends list
    onlineCount,               // FIX: Navbar shows live connected-user count
    onNavigate: navigate,
    onLogout:   handleLogout,
    onOpenProfile: () => navigate('/profile'),
    onStartChat: (_friend: any) => navigate('/chat'),
  };

  return (
    <Routes>
      {/* ── Public routes ─────────────────────────────────────────── */}
      <Route path="/" element={<Landing onNavigate={navigate} />} />
      <Route
        path="/login"
        element={<Login onLogin={handleLogin} onNavigate={navigate} isLoading={isLoading} />}
      />
      <Route
        path="/register"
        element={<Register onRegister={handleRegister} onNavigate={navigate} isLoading={isLoading} />}
      />

      {/* ── Protected: Dashboard ──────────────────────────────────── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout {...sharedLayoutProps} currentRoute="/dashboard">
              <Dashboard
                user={user ?? undefined}
                onlineFriends={onlineFriends}   // FIX: live online friends count
                onNavigate={navigate}
              />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* ── Protected: Friends ────────────────────────────────────── */}
      <Route
        path="/friends"
        element={
          <ProtectedRoute>
            <Layout {...sharedLayoutProps} currentRoute="/friends">
              <Friends
                friends={friends}
                requests={[...pendingRequests]}
                isLoading={friendsLoading}
                onNavigate={navigate}
                onStartChat={(_friend) => navigate('/chat')}
                onRemoveFriend={removeFriend}
                onBlockUser={blockUser}
                onAcceptRequest={acceptRequest}
                onRejectRequest={rejectRequest}
              />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* ── Protected: Profile ────────────────────────────────────── */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout {...sharedLayoutProps} currentRoute="/profile">
              {/* FIX: pass real user data and stats; wire update handler */}
              <Profile
                user={user ? {
                  id:          user.id,
                  username:    user.username,
                  email:       user.email,
                  avatar:      user.avatar ?? null,
                  bio:         (user as any).bio ?? '',
                  joinedAt:    (user as any).created_at
                                 ? new Date((user as any).created_at)
                                 : undefined,
                  chatCount:   userStats.chatCount,
                  friendCount: userStats.friendCount,
                } : undefined}
                onUpdateProfile={handleUpdateProfile}
              />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* ── Chat — full-screen, no Layout wrapper ─────────────────── */}
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />

      {/* ── 404 ───────────────────────────────────────────────────── */}
      <Route path="*" element={<NotFound onNavigate={navigate} />} />
    </Routes>
  );
};

// ── Root ─────────────────────────────────────────────────────────────────────
const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <SocketProvider>
        <AppRoutes />
      </SocketProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
