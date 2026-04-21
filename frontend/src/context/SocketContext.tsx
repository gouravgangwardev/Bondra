// src/context/SocketContext.tsx
// FIX Bug 3: Prevent infinite reconnect loop caused by setSocket(null) in cleanup
// triggering a re-render which re-runs the effect.
// Solution: only call disconnect when isAuthenticated goes false, not in every cleanup.
import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
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

  // Track whether we've already connected for this token so we don't reconnect on
  // every render (the real root of Bug 3).
  const connectedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Case: unauthenticated — tear down any existing socket
    if (!isAuthenticated || !accessToken) {
      if (connectedTokenRef.current) {
        socketService.disconnect();
        connectedTokenRef.current = null;
        setSocket(null);
        setIsConnected(false);
        setOnlineCount(0);
      }
      return;
    }

    // Case: already connected with the same token — nothing to do
    if (connectedTokenRef.current === accessToken) {
      return;
    }

    // Case: new token — connect fresh
    connectedTokenRef.current = accessToken;
    const newSocket = socketService.connect(accessToken);
    setSocket(newSocket);

    const handleConnect = () => {
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

    newSocket.on('connect',       handleConnect);
    newSocket.on('disconnect',    handleDisconnect);
    newSocket.on('connect_error', handleConnectError);
    newSocket.on('error',         handleError);
    newSocket.on('user:count',    handleOnlineCount);  // WSEvents.USER_COUNT

    // Cleanup: only remove listeners — do NOT disconnect here.
    // Disconnection happens above when auth state changes.
    return () => {
      newSocket.off('connect',       handleConnect);
      newSocket.off('disconnect',    handleDisconnect);
      newSocket.off('connect_error', handleConnectError);
      newSocket.off('error',         handleError);
      newSocket.off('user:count',    handleOnlineCount);
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
