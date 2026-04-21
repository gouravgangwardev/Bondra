// src/models/Report.ts
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { ReportReason } from '../config/constants';

export interface IReport {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  session_id: string | null;
  reason: ReportReason;
  description: string | null;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
}

export interface IReportWithDetails {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  session_id: string | null;
  reason: ReportReason;
  description: string | null;
  status: string;
  reporter_username: string;
  reported_username: string;
  session_type: string | null;
  created_at: Date;
  reviewed_at: Date | null;
}

export class Report {
  // Create new report
  static async create(
    reporterId: string,
    reportedUserId: string,
    reason: ReportReason,
    description?: string,
    sessionId?: string
  ): Promise<IReport | null> {
    try {
      const result = await query(
        `INSERT INTO reports (reporter_id, reported_user_id, session_id, reason, description, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
         RETURNING *`,
        [reporterId, reportedUserId, sessionId || null, reason, description || null]
      );

      logger.info(`Report created: ${reporterId} reported ${reportedUserId} for ${reason}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating report:', error);
      return null;
    }
  }

  // Find report by ID
  static async findById(id: string): Promise<IReport | null> {
    try {
      const result = await query(
        'SELECT * FROM reports WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding report by ID:', error);
      return null;
    }
  }

  // Get report with details
  static async getReportWithDetails(id: string): Promise<IReportWithDetails | null> {
    try {
      const result = await query(
        `SELECT 
          r.*,
          u1.username as reporter_username,
          u2.username as reported_username,
          s.session_type
         FROM reports r
         JOIN users u1 ON u1.id = r.reporter_id
         JOIN users u2 ON u2.id = r.reported_user_id
         LEFT JOIN sessions s ON s.id = r.session_id
         WHERE r.id = $1`,
        [id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting report with details:', error);
      return null;
    }
  }

  // Get all reports (paginated, for admin)
  static async getAll(
    page: number = 1,
    limit: number = 20,
    status?: string
  ): Promise<IReportWithDetails[]> {
    try {
      const offset = (page - 1) * limit;
      
      let queryText = `
        SELECT 
          r.*,
          u1.username as reporter_username,
          u2.username as reported_username,
          s.session_type
         FROM reports r
         JOIN users u1 ON u1.id = r.reporter_id
         JOIN users u2 ON u2.id = r.reported_user_id
         LEFT JOIN sessions s ON s.id = r.session_id
      `;

      const params: any[] = [limit, offset];
      
      if (status) {
        queryText += ' WHERE r.status = $3';
        params.push(status);
      }

      queryText += ' ORDER BY r.created_at DESC LIMIT $1 OFFSET $2';

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting all reports:', error);
      return [];
    }
  }

  // Get reports by reported user
  static async getByReportedUser(
    reportedUserId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<IReportWithDetails[]> {
    try {
      const offset = (page - 1) * limit;
      
      const result = await query(
        `SELECT 
          r.*,
          u1.username as reporter_username,
          u2.username as reported_username,
          s.session_type
         FROM reports r
         JOIN users u1 ON u1.id = r.reporter_id
         JOIN users u2 ON u2.id = r.reported_user_id
         LEFT JOIN sessions s ON s.id = r.session_id
         WHERE r.reported_user_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [reportedUserId, limit, offset]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting reports by reported user:', error);
      return [];
    }
  }

  // Get reports by reporter
  static async getByReporter(
    reporterId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<IReportWithDetails[]> {
    try {
      const offset = (page - 1) * limit;
      
      const result = await query(
        `SELECT 
          r.*,
          u1.username as reporter_username,
          u2.username as reported_username,
          s.session_type
         FROM reports r
         JOIN users u1 ON u1.id = r.reporter_id
         JOIN users u2 ON u2.id = r.reported_user_id
         LEFT JOIN sessions s ON s.id = r.session_id
         WHERE r.reporter_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [reporterId, limit, offset]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting reports by reporter:', error);
      return [];
    }
  }

  // Update report status
  static async updateStatus(
    id: string,
    status: 'reviewed' | 'resolved' | 'dismissed',
    reviewerId?: string
  ): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE reports 
         SET status = $1, reviewed_by = $2, reviewed_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [status, reviewerId || null, id]
      );

      if (result.rows.length === 0) {
        logger.warn(`Report ${id} not found`);
        return false;
      }

      logger.info(`Report ${id} status updated to ${status}`);
      return true;
    } catch (error) {
      logger.error('Error updating report status:', error);
      return false;
    }
  }

  // Check if user has already reported another user in a session
  static async hasReported(
    reporterId: string,
    reportedUserId: string,
    sessionId?: string
  ): Promise<boolean> {
    try {
      let queryText = `
        SELECT 1 FROM reports 
        WHERE reporter_id = $1 AND reported_user_id = $2
      `;
      const params = [reporterId, reportedUserId];

      if (sessionId) {
        queryText += ' AND session_id = $3';
        params.push(sessionId);
      }

      queryText += ' LIMIT 1';

      const result = await query(queryText, params);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking if user has reported:', error);
      return false;
    }
  }

  // Get report count for user (how many times they've been reported)
  static async getReportCount(userId: string): Promise<number> {
    try {
      const result = await query(
        'SELECT COUNT(*) FROM reports WHERE reported_user_id = $1',
        [userId]
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting report count:', error);
      return 0;
    }
  }

  // Get pending reports count
  static async getPendingCount(): Promise<number> {
    try {
      const result = await query(
        "SELECT COUNT(*) FROM reports WHERE status = 'pending'",
        []
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting pending reports count:', error);
      return 0;
    }
  }

  // Get report statistics by reason
  static async getStatsByReason(): Promise<any> {
    try {
      const result = await query(
        `SELECT 
          reason,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
          COUNT(CASE WHEN status = 'dismissed' THEN 1 END) as dismissed_count
         FROM reports
         GROUP BY reason
         ORDER BY count DESC`,
        []
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting report stats by reason:', error);
      return [];
    }
  }

  // Get most reported users
  static async getMostReportedUsers(limit: number = 10): Promise<any[]> {
    try {
      const result = await query(
        `SELECT 
          reported_user_id,
          u.username,
          COUNT(*) as report_count,
          COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_count
         FROM reports r
         JOIN users u ON u.id = r.reported_user_id
         GROUP BY reported_user_id, u.username
         ORDER BY report_count DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting most reported users:', error);
      return [];
    }
  }

  // Get report statistics (for admin dashboard)
  static async getOverallStats(): Promise<any> {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_reports,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as reviewed,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
          COUNT(CASE WHEN status = 'dismissed' THEN 1 END) as dismissed,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as reports_24h,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as reports_7d
         FROM reports`,
        []
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting overall report stats:', error);
      return null;
    }
  }

  // Delete old resolved/dismissed reports (for cleanup)
  static async deleteOldReports(daysOld: number = 90): Promise<number> {
    try {
      // Bug 8 fix: use make_interval() with a parameterized value instead of
      // interpolating daysOld directly into the SQL string.
      const result = await query(
        `DELETE FROM reports
         WHERE created_at < NOW() - make_interval(days => $1)
         AND status IN ('resolved', 'dismissed')
         RETURNING id`,
        [daysOld]
      );

      const count = result.rows.length;
      if (count > 0) {
        logger.info(`Deleted ${count} old reports (>${daysOld} days)`);
      }

      return count;
    } catch (error) {
      logger.error('Error deleting old reports:', error);
      return 0;
    }
  }

  // Get recent reports (last 24 hours)
  static async getRecentReports(limit: number = 20): Promise<IReportWithDetails[]> {
    try {
      const result = await query(
        `SELECT 
          r.*,
          u1.username as reporter_username,
          u2.username as reported_username,
          s.session_type
         FROM reports r
         JOIN users u1 ON u1.id = r.reporter_id
         JOIN users u2 ON u2.id = r.reported_user_id
         LEFT JOIN sessions s ON s.id = r.session_id
         WHERE r.created_at > NOW() - INTERVAL '24 hours'
         ORDER BY r.created_at DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting recent reports:', error);
      return [];
    }
  }

  // Get reports for a specific session
  static async getBySession(sessionId: string): Promise<IReportWithDetails[]> {
    try {
      const result = await query(
        `SELECT 
          r.*,
          u1.username as reporter_username,
          u2.username as reported_username,
          s.session_type
         FROM reports r
         JOIN users u1 ON u1.id = r.reporter_id
         JOIN users u2 ON u2.id = r.reported_user_id
         LEFT JOIN sessions s ON s.id = r.session_id
         WHERE r.session_id = $1
         ORDER BY r.created_at DESC`,
        [sessionId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting reports by session:', error);
      return [];
    }
  }
}

export default Report;