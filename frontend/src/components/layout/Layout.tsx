// src/components/layout/Layout.tsx
import React, { useState } from 'react';
import Navbar, { User } from './Navbar';
import Sidebar from './Sidebar';
import { Friend } from '../friends/FriendCard';

interface LayoutProps {
  children: React.ReactNode;
  user?: User | null;
  friends?: Friend[];
  currentRoute?: string;
  onlineCount?: number;
  unreadNotifications?: number;
  showSidebar?: boolean;
  onNavigate?: (route: string) => void;
  onLogout?: () => void;
  onOpenSettings?: () => void;
  onOpenProfile?: () => void;
  onStartChat?: (friend: Friend) => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  user,
  friends = [],
  currentRoute = '/',
  onlineCount = 0,
  unreadNotifications = 0,
  showSidebar = true,
  onNavigate,
  onLogout,
  onOpenSettings,
  onOpenProfile,
  onStartChat,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      
      {/* Top Navbar */}
      <Navbar
        user={user}
        onlineCount={onlineCount}
        unreadNotifications={unreadNotifications}
        onNavigate={onNavigate}
        onLogout={onLogout}
        onOpenSettings={onOpenSettings}
        onOpenProfile={onOpenProfile}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar */}
        {showSidebar && (
          <Sidebar
            currentRoute={currentRoute}
            friends={friends}
            onNavigate={onNavigate}
            onStartChat={onStartChat}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
