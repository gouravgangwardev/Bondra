// ============================================
// FILE: src/services/sessionCleanup.ts - Session Management
// ============================================
import { Server as SocketServer } from 'socket.io';
import logger from '../utils/logger';

export interface Session {
  id: string;
  user1Id: string;
  user2Id: string;
  mode: 'video' | 'audio' | 'text';
  type: 'random' | 'friend';
  lastActivity: number;
  createdAt: number;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute

  constructor(private io: SocketServer) {
    // Start cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);

    logger.info('SessionManager initialized');
  }

  /**
   * Add a new session
   */
  addSession(session: Omit<Session, 'lastActivity' | 'createdAt'>) {
    const newSession: Session = {
      ...session,
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };

    this.sessions.set(session.id, newSession);
    logger.info(`Session created: ${session.id} (${session.mode})`);
    return newSession;
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get sessions count
   */
  getSessionsCount(): number {
    return this.sessions.size;
  }

  /**
   * Get sessions by user ID
   */
  getSessionsByUser(userId: string): Session[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.user1Id === userId || session.user2Id === userId
    );
  }

  /**
   * Remove a session
   */
  removeSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.info(`Session removed: ${sessionId}`);
    }
    return deleted;
  }

  /**
   * Clean up inactive sessions
   */
  private cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    this.sessions.forEach((session, sessionId) => {
      const inactiveTime = now - session.lastActivity;

      if (inactiveTime > this.SESSION_TIMEOUT) {
        logger.warn(`Cleaning up inactive session: ${sessionId} (inactive for ${Math.floor(inactiveTime / 1000)}s)`);

        // Notify both users about timeout
        this.io.to(session.user1Id).emit('session:timeout', {
          sessionId,
          reason: 'Inactivity timeout',
        });

        this.io.to(session.user2Id).emit('session:timeout', {
          sessionId,
          reason: 'Inactivity timeout',
        });

        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} inactive sessions`);
    }

    logger.debug(`Active sessions: ${this.sessions.size}`);
  }

  /**
   * Get session statistics
   */
  getStats() {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();

    return {
      total: sessions.length,
      byMode: {
        video: sessions.filter((s) => s.mode === 'video').length,
        audio: sessions.filter((s) => s.mode === 'audio').length,
        text: sessions.filter((s) => s.mode === 'text').length,
      },
      byType: {
        random: sessions.filter((s) => s.type === 'random').length,
        friend: sessions.filter((s) => s.type === 'friend').length,
      },
      avgDuration: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (now - s.createdAt), 0) / sessions.length / 1000
        : 0,
    };
  }

  /**
   * Clean up and stop the manager
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
    logger.info('SessionManager destroyed');
  }
}
