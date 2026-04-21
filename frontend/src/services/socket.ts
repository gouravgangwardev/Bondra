// src/services/socket.ts
//
// FIXES IN THIS FILE
// ==================
// ERROR 4 (previous batch, preserved) — Stale socket abandoned when connect()
//   called while socket existed but was not connected.
//   Fix: tear down stale socket fully before constructing a new one.
//
// ERROR 5 (MEDIUM) — setupEventHandlers() called this.disconnect() after 5
//   consecutive connect_error events.  this.disconnect() calls
//   socket.removeAllListeners() then socket.close() — which destroys the socket
//   that SocketContext is holding and listening on.  SocketContext was never
//   notified; its socket state kept pointing at the now-dead object.  All
//   subsequent emit() calls were silently dropped (isConnected() returns false
//   because socket.connected is false on the closed socket, but the socket state
//   in React still appeared valid).
//
//   Root cause: The internal service layer should not decide to permanently close
//   the socket — that is the responsibility of SocketContext, which owns the
//   socket lifecycle and can update React state accordingly.  socket.io-client
//   already respects its own reconnectionAttempts limit configured at io() time;
//   once that cap is hit it stops retrying on its own and emits a final
//   'disconnect' event, which SocketContext listens to.  The manual disconnect()
//   call was redundant and destructive.
//
//   Fix: remove the this.disconnect() call from the connect_error handler.
//   Counter is kept for logging/debugging only.

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts     = 0;
  private maxReconnectAttempts  = 5;

  // ── Connection management ──────────────────────────────────────────────────

  connect(accessToken: string): Socket {
    // Happy path: already connected — reuse the existing socket.
    if (this.socket?.connected) {
      return this.socket;
    }

    // ERROR 4 fix (preserved): tear down any stale socket before creating a new
    // one.  This covers the case where this.socket exists but is disconnected or
    // stuck in a reconnecting loop.  Without this, the old socket is abandoned
    // with live timers and listeners pointing at the discarded instance.
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token: accessToken,
      },
      transports:           ['websocket', 'polling'],
      reconnection:         true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay:    1000,
      reconnectionDelayMax: 5000,
      timeout:              10000,
    });

    this.setupEventHandlers();
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }
  }

  // ── Core event handlers ────────────────────────────────────────────────────

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    // FIX ERROR 5: do NOT call this.disconnect() here.
    // socket.io-client already stops retrying after `reconnectionAttempts` and
    // emits 'disconnect' — SocketContext reacts to that event and updates state.
    // Calling this.disconnect() here would call removeAllListeners() + close()
    // on the socket that SocketContext owns, leaving React state pointing at a
    // dead object with no notification.
    this.socket.on('connect_error', (error) => {
      console.error('🔴 Socket connection error:', error.message);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        // Log only — let socket.io's own reconnectionAttempts cap handle teardown
        // and surface it via the 'disconnect' event that SocketContext listens to.
        console.error('Max reconnection attempts reached — socket.io will stop retrying');
      }
    });

    this.socket.on('error', (error) => {
      console.error('🔴 Socket error:', error);
    });

    // Presence: user:count is handled in SocketContext — no duplicate listener here.
  }

  // ── Utility ────────────────────────────────────────────────────────────────

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  once(event: string, callback: (...args: any[]) => void) {
    this.socket?.once(event, callback);
  }

  // ── Matching ───────────────────────────────────────────────────────────────

  joinQueue(type: 'video' | 'audio' | 'text') {
    this.emit('queue:join', { type });
  }

  leaveQueue(type?: string) {
    this.emit('queue:leave', { type });
  }

  onQueueUpdate(callback: (data: { position: number; estimatedWaitTime: number }) => void) {
    this.on('queue:position', callback);
  }

  onMatched(callback: (data: { sessionId: string; partner: any }) => void) {
    this.on('match:found', callback);
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  sendMessage(_sessionId: string, content: string) {
    this.emit('chat:message', { message: content });
  }

  sendTyping(_sessionId: string, _isTyping: boolean) {
    this.emit('chat:typing');
  }

  sendReaction(_sessionId: string, _messageId: string, _emoji: string) {
    // Not supported by backend — no-op
  }

  skipPartner(_sessionId: string) {
    this.emit('match:next');
  }

  endSession(_sessionId: string) {
    this.emit('call:end');
  }

  reportUser(_sessionId: string, reportedUserId: string, reason: string) {
    this.emit('report:user', { reportedUserId, reason });
  }

  onMessage(callback: (data: any) => void) {
    this.on('chat:message', callback);
  }

  onTyping(callback: (data: { isTyping: boolean }) => void) {
    this.on('chat:typing', callback);
  }

  onReaction(callback: (data: { messageId: string; emoji: string; userId: string }) => void) {
    this.on('chat:reaction', callback);
  }

  // ── WebRTC signaling ───────────────────────────────────────────────────────

  sendOffer(_sessionId: string, offer: RTCSessionDescriptionInit) {
    this.emit('call:offer', { offer });
  }

  sendAnswer(_sessionId: string, answer: RTCSessionDescriptionInit) {
    this.emit('call:answer', { answer });
  }

  sendIceCandidate(_sessionId: string, candidate: RTCIceCandidateInit) {
    this.emit('call:ice', { candidate });
  }

  onOffer(callback: (data: { offer: RTCSessionDescriptionInit }) => void) {
    this.on('call:offer', callback);
  }

  onAnswer(callback: (data: { answer: RTCSessionDescriptionInit }) => void) {
    this.on('call:answer', callback);
  }

  onIceCandidate(callback: (data: { candidate: RTCIceCandidateInit }) => void) {
    this.on('call:ice', callback);
  }

  // ── Friends ────────────────────────────────────────────────────────────────

  sendFriendRequest(userId: string, _message?: string) {
    this.emit('friend:request:send', { friendId: userId });
  }

  onFriendRequest(callback: (data: any) => void) {
    this.on('friend:request:received', callback);
  }

  onFriendRequestAccepted(callback: (data: any) => void) {
    this.on('friend:request:accept', callback);
  }

  onFriendOnline(callback: (data: { friendId: string }) => void) {
    this.on('friend:online', callback);
  }

  onFriendOffline(callback: (data: { friendId: string }) => void) {
    this.on('friend:offline', callback);
  }
}

// Export singleton instance
export const socketService = new SocketService();

// Export class for testing
export default SocketService;