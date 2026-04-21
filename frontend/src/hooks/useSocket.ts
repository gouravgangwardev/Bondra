// src/hooks/useSocket.ts
// FIX Bug 14: useSocket no longer creates a second raw socket.
//   It reads from the SocketContext singleton instead.
// FIX Bug 5: useSocketEvent uses a ref for the callback so the listener
//   is not torn down and re-added on every render.
import { useEffect, useRef, useCallback, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useSocketContext } from '../context/SocketContext';

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
}

// Re-export the shared context socket so call sites don't need to change.
export const useSocket = (): UseSocketReturn => {
  const { socket, isConnected, error } = useSocketContext();

  const emit = useCallback((event: string, data?: any) => {
    if (socket?.connected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }, [socket]);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    socket?.on(event, callback);
  }, [socket]);

  const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
    if (callback) {
      socket?.off(event, callback);
    } else {
      socket?.off(event);
    }
  }, [socket]);

  return { socket, isConnected, error, emit, on, off };
};

// FIX Bug 5: Store callback in a ref so the effect only re-runs when the
// socket instance or event name changes — not on every render because the
// caller passed a new inline function.
export const useSocketEvent = (
  socket: Socket | null,
  event: string,
  callback: (...args: any[]) => void
) => {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!socket) return;
    const handler = (...args: any[]) => callbackRef.current(...args);
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [socket, event]); // callback intentionally excluded — stored in ref
};

export const usePresence = (socket: Socket | null) => {
  const [onlineCount, setOnlineCount] = useState(0);
  // FIX Bug 5: inline arrow passed to useSocketEvent is now safely ref'd
  useSocketEvent(socket, 'user:count', (count: number) => {
    setOnlineCount(count);
  });
  return { onlineCount };
};
