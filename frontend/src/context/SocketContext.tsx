// src/context/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { socketService } from '../services/socket';
import { useAuthContext } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineCount: number;
  error: string | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { accessToken, isAuthenticated } = useAuthContext();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only connect if authenticated
    if (!isAuthenticated || !accessToken) {
      // Disconnect if previously connected
      if (socket) {
        socketService.disconnect();
        setSocket(null);
        setIsConnected(false);
        setOnlineCount(0);
      }
      return;
    }

    // Connect socket
    const newSocket = socketService.connect(accessToken);
    setSocket(newSocket);

    // Setup event handlers
    const handleConnect = () => {
      console.log('✅ Socket connected');
      setIsConnected(true);
      setError(null);
    };

    const handleDisconnect = (reason: string) => {
      console.log('❌ Socket disconnected:', reason);
      setIsConnected(false);
    };

    const handleConnectError = (err: Error) => {
      console.error('🔴 Socket connection error:', err);
      setError(err.message);
    };

    const handleError = (err: any) => {
      console.error('🔴 Socket error:', err);
      setError(err.message || 'Socket error occurred');
    };

    const handleOnlineCount = (count: number) => {
      setOnlineCount(count);
    };

    // Register event listeners
    newSocket.on('connect', handleConnect);
    newSocket.on('disconnect', handleDisconnect);
    newSocket.on('connect_error', handleConnectError);
    newSocket.on('error', handleError);
    newSocket.on('presence:online-count', handleOnlineCount);

    // Cleanup on unmount or auth change
    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('disconnect', handleDisconnect);
      newSocket.off('connect_error', handleConnectError);
      newSocket.off('error', handleError);
      newSocket.off('presence:online-count', handleOnlineCount);
      
      socketService.disconnect();
      setSocket(null);
      setIsConnected(false);
      setOnlineCount(0);
    };
  }, [isAuthenticated, accessToken]);

  const value: SocketContextType = {
    socket,
    isConnected,
    onlineCount,
    error,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocketContext = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within SocketProvider');
  }
  return context;
};

export default SocketContext;