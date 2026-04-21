// src/models/Session.ts
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { SessionType, SessionStatus } from '../config/constants';

export interface ISession {
  id: string;
  session_type: SessionType;
  user1_id: string;
  user2_id: string;
  status: SessionStatus;
  started_at: Date;
  ended_at: Date | null;
  created_at: Date;
}

export interface ISessionWithUsers {
  id: string;
  session_type: SessionType;
  user1_id: string;
  user2_id: string;
  status: SessionStatus;
  started_at: Date;
  ended_at: Date | null;
  user1_username: string;
  user2_username: string;
  user1_avatar: string | null;
  user2_avatar: string | null;
  duration_seconds: number | null;
}

export class Session {
  // Create new session
  static async create(
    sessionType: SessionType,
    user1Id: string,
    user2Id: string
  ): Promise<ISession | null> {
    try {
      const result = await query(
        `INSERT INTO sessions (session_type, user1_id, user2_id, status, started_at, created_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [sessionType, user1Id, user2Id, SessionStatus.ACTIVE]
      );

      logger.info(`Session created: ${sessionType} between ${user1Id} and ${user2Id}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating session:', error);
      return null;
    }
  }

  // Find session by ID
  static async findById(id: string): Promise<ISession | null> {
    try {
      const result = await query(
        'SELECT * FROM sessions WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding session by ID:', error);
      return null;
    }
  }

  // Find active session for user
  static async findActiveSession(userId: string): Promise<ISession | null> {
    try {
      const result = await query(
        `SELECT * FROM sessions 
         WHERE (user1_id = $1 OR user2_id = $1) 
         AND status = $2
         ORDER BY started_at DESC
         LIMIT 1`,
        [userId, SessionStatus.ACTIVE]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding active session:', error);
      return null;
    }
  }

  // End session
  static async endSession(id: string, status: SessionStatus = SessionStatus.ENDED): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE sessions 
         SET status = $1, ended_at = NOW()
         WHERE id = $2 AND status = $3
         RETURNING *`,
        [status, id, SessionStatus.ACTIVE]
      );

      if (result.rows.length === 0) {
        logger.warn(`Session ${id} not found or already ended`);
        return false;
      }

      logger.info(`Session ended: ${id} with status ${status}`);
      return true;
    } catch (error) {
      logger.error('Error ending session:', error);
      return false;
    }
  }

  // Get session with user details
  static async getSessionWithUsers(id: string): Promise<ISessionWithUsers | null> {
    try {
      const result = await query(
        `SELECT 
          s.*,
          u1.username as user1_username,
          u1.avatar_url as user1_avatar,
          u2.username as user2_username,
          u2.avatar_url as user2_avatar,
          EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at)) as duration_seconds
         FROM sessions s
         JOIN users u1 ON u1.id = s.user1_id
         JOIN users u2 ON u2.id = s.user2_id
         WHERE s.id = $1`,
        [id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting session with users:', error);
      return null;
    }
  }

  // Get user's session history
  static async getUserSessions(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ISessionWithUsers[]> {
    try {
      const offset = (page - 1) * limit;
      
      const result = await query(
        `SELECT 
          s.*,
          u1.username as user1_username,
          u1.avatar_url as user1_avatar,
          u2.username as user2_username,
          u2.avatar_url as user2_avatar,
          EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at)) as duration_seconds
         FROM sessions s
         JOIN users u1 ON u1.id = s.user1_id
         JOIN users u2 ON u2.id = s.user2_id
         WHERE s.user1_id = $1 OR s.user2_id = $1
         ORDER BY s.started_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting user sessions:', error);
      return [];
    }
  }

  // Get session statistics for user
  static async getUserStats(userId: string): Promise<any> {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN session_type = $2 THEN 1 END) as video_sessions,
          COUNT(CASE WHEN session_type = $3 THEN 1 END) as audio_sessions,
          COUNT(CASE WHEN session_type = $4 THEN 1 END) as text_sessions,
          AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))) as avg_duration_seconds,
          MAX(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))) as max_duration_seconds,
          MIN(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))) as min_duration_seconds
         FROM sessions
         WHERE (user1_id = $1 OR user2_id = $1) AND status = $5`,
        [
          userId,
          SessionType.VIDEO,
          SessionType.AUDIO,
          SessionType.TEXT,
          SessionStatus.ENDED
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting user session stats:', error);
      return null;
    }
  }

  // Get active sessions count
  static async getActiveSessionsCount(): Promise<number> {
    try {
      const result = await query(
        'SELECT COUNT(*) FROM sessions WHERE status = $1',
        [SessionStatus.ACTIVE]
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting active sessions count:', error);
      return 0;
    }
  }

  // Get active sessions count by type
  static async getActiveSessionsByType(): Promise<any> {
    try {
      const result = await query(
        `SELECT 
          session_type,
          COUNT(*) as count
         FROM sessions
         WHERE status = $1
         GROUP BY session_type`,
        [SessionStatus.ACTIVE]
      );

      const stats: any = {
        video: 0,
        audio: 0,
        text: 0,
      };

      result.rows.forEach(row => {
        stats[row.session_type] = parseInt(row.count);
      });

      return stats;
    } catch (error) {
      logger.error('Error getting active sessions by type:', error);
      return { video: 0, audio: 0, text: 0 };
    }
  }

  // Cleanup abandoned sessions (sessions active for too long)
  static async cleanupAbandonedSessions(maxDurationMinutes: number = 60): Promise<number> {
    try {
      // Bug 8 fix: use make_interval() with a parameterized value instead of
      // interpolating maxDurationMinutes directly into the SQL string.
      const result = await query(
        `UPDATE sessions
         SET status = $1, ended_at = NOW()
         WHERE status = $2
         AND started_at < NOW() - make_interval(mins => $3)
         RETURNING id`,
        [SessionStatus.ABANDONED, SessionStatus.ACTIVE, maxDurationMinutes]
      );

      const count = result.rows.length;
      if (count > 0) {
        logger.info(`Cleaned up ${count} abandoned sessions`);
      }

      return count;
    } catch (error) {
      logger.error('Error cleaning up abandoned sessions:', error);
      return 0;
    }
  }

  // Check if two users have had a session together
  static async haveHadSession(user1Id: string, user2Id: string): Promise<boolean> {
    try {
      const result = await query(
        `SELECT 1 FROM sessions 
         WHERE ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))
         LIMIT 1`,
        [user1Id, user2Id]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking session history:', error);
      return false;
    }
  }

  // Get recent sessions (last 24 hours)
  static async getRecentSessions(limit: number = 50): Promise<ISessionWithUsers[]> {
    try {
      const result = await query(
        `SELECT 
          s.*,
          u1.username as user1_username,
          u1.avatar_url as user1_avatar,
          u2.username as user2_username,
          u2.avatar_url as user2_avatar,
          EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at)) as duration_seconds
         FROM sessions s
         JOIN users u1 ON u1.id = s.user1_id
         JOIN users u2 ON u2.id = s.user2_id
         WHERE s.started_at > NOW() - INTERVAL '24 hours'
         ORDER BY s.started_at DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting recent sessions:', error);
      return [];
    }
  }

  // Get platform statistics (for admin dashboard)
  static async getPlatformStats(): Promise<any> {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN status = $1 THEN 1 END) as active_sessions,
          COUNT(CASE WHEN status = $2 THEN 1 END) as ended_sessions,
          COUNT(CASE WHEN session_type = $3 THEN 1 END) as video_sessions,
          COUNT(CASE WHEN session_type = $4 THEN 1 END) as audio_sessions,
          COUNT(CASE WHEN session_type = $5 THEN 1 END) as text_sessions,
          AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))) as avg_duration_seconds,
          COUNT(CASE WHEN started_at > NOW() - INTERVAL '24 hours' THEN 1 END) as sessions_24h,
          COUNT(CASE WHEN started_at > NOW() - INTERVAL '7 days' THEN 1 END) as sessions_7d
         FROM sessions`,
        [
          SessionStatus.ACTIVE,
          SessionStatus.ENDED,
          SessionType.VIDEO,
          SessionType.AUDIO,
          SessionType.TEXT
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting platform stats:', error);
      return null;
    }
  }

  // Delete old sessions (for data cleanup)
  static async deleteOldSessions(daysOld: number = 30): Promise<number> {
    try {
      // Bug 8 fix: use make_interval() with a parameterized value.
      const result = await query(
        `DELETE FROM sessions
         WHERE started_at < NOW() - make_interval(days => $2)
         AND status != $1
         RETURNING id`,
        [SessionStatus.ACTIVE, daysOld]
      );

      const count = result.rows.length;
      if (count > 0) {
        logger.info(`Deleted ${count} old sessions (>${daysOld} days)`);
      }

      return count;
    } catch (error) {
      logger.error('Error deleting old sessions:', error);
      return 0;
    }
  }
}

export default Session;