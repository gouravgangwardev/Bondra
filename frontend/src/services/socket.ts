// src/services/socket.ts
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_ || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Initialize socket connection
  connect(accessToken: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token: accessToken,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.setupEventHandlers();
    return this.socket;
  }

  // Setup core event handlers
  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔴 Socket connection error:', error.message);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.disconnect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('🔴 Socket error:', error);
    });

    // Presence events
    this.socket.on('presence:online-count', (count: number) => {
      console.log('👥 Online users:', count);
    });
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }
  }

  // Get current socket instance
  getSocket(): Socket | null {
    return this.socket;
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Emit event
  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  // Register event listener
  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  // Unregister event listener
  off(event: string, callback?: (...args: any[]) => void) {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  // One-time event listener
  once(event: string, callback: (...args: any[]) => void) {
    this.socket?.once(event, callback);
  }

  // ========================================================================
  // MATCHING EVENTS
  // ========================================================================

  joinQueue(type: 'video' | 'audio' | 'text') {
    this.emit('matching:join-queue', { type });
  }

  leaveQueue() {
    this.emit('matching:leave-queue');
  }

  onQueueUpdate(callback: (data: { position: number; estimatedWaitTime: number }) => void) {
    this.on('matching:queue-update', callback);
  }

  onMatched(callback: (data: { sessionId: string; partner: any }) => void) {
    this.on('matching:matched', callback);
  }

  // ========================================================================
  // CHAT EVENTS
  // ========================================================================

  sendMessage(sessionId: string, content: string) {
    this.emit('chat:send-message', { sessionId, content });
  }

  sendTyping(sessionId: string, isTyping: boolean) {
    this.emit('chat:typing', { sessionId, isTyping });
  }

  sendReaction(sessionId: string, messageId: string, emoji: string) {
    this.emit('chat:react', { sessionId, messageId, emoji });
  }

  skipPartner(sessionId: string) {
    this.emit('chat:skip', { sessionId });
  }

  endSession(sessionId: string) {
    this.emit('chat:end-session', { sessionId });
  }

  reportUser(sessionId: string, reportedUserId: string, reason: string) {
    this.emit('chat:report', { sessionId, reportedUserId, reason });
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

  // ========================================================================
  // WEBRTC SIGNALING EVENTS
  // ========================================================================

  sendOffer(sessionId: string, offer: RTCSessionDescriptionInit) {
    this.emit('webrtc:offer', { sessionId, offer });
  }

  sendAnswer(sessionId: string, answer: RTCSessionDescriptionInit) {
    this.emit('webrtc:answer', { sessionId, answer });
  }

  sendIceCandidate(sessionId: string, candidate: RTCIceCandidateInit) {
    this.emit('webrtc:ice-candidate', { sessionId, candidate });
  }

  onOffer(callback: (data: { offer: RTCSessionDescriptionInit }) => void) {
    this.on('webrtc:offer', callback);
  }

  onAnswer(callback: (data: { answer: RTCSessionDescriptionInit }) => void) {
    this.on('webrtc:answer', callback);
  }

  onIceCandidate(callback: (data: { candidate: RTCIceCandidateInit }) => void) {
    this.on('webrtc:ice-candidate', callback);
  }

  // ========================================================================
  // FRIEND EVENTS
  // ========================================================================

  sendFriendRequest(userId: string, message?: string) {
    this.emit('friends:send-request', { userId, message });
  }

  onFriendRequest(callback: (data: any) => void) {
    this.on('friends:request-received', callback);
  }

  onFriendRequestAccepted(callback: (data: any) => void) {
    this.on('friends:request-accepted', callback);
  }

  onFriendOnline(callback: (data: { friendId: string }) => void) {
    this.on('friends:online', callback);
  }

  onFriendOffline(callback: (data: { friendId: string }) => void) {
    this.on('friends:offline', callback);
  }
}

// Export singleton instance
export const socketService = new SocketService();

// Export class for testing
export default SocketService;