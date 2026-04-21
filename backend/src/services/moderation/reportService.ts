// src/services/moderation/reportService.ts
import { Report, IReport, IReportWithDetails } from '../../models/Report';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { ReportReason } from '../../config/constants';
import { MetricsService } from '../../config/monitoring';

export interface IReportResult {
  success: boolean;
  message?: string;
  error?: string;
  reportId?: string;
}

export class ReportService {
  private readonly MAX_REPORTS_THRESHOLD = 5; // Auto-ban after 5 reports
  private readonly REPORT_COOLDOWN = 3600000; // 1 hour between reports

  // Submit a report
  static async submitReport(
    reporterId: string,
    reportedUserId: string,
    reason: ReportReason,
    description?: string,
    sessionId?: string
  ): Promise<IReportResult> {
    try {
      // Check if reporting self
      if (reporterId === reportedUserId) {
        return {
          success: false,
          error: 'Cannot report yourself',
        };
      }

      // Check if reported user exists
      const reportedUser = await User.findById(reportedUserId);
      if (!reportedUser) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Check if already reported this user in this session
      if (sessionId) {
        const alreadyReported = await Report.hasReported(
          reporterId,
          reportedUserId,
          sessionId
        );

        if (alreadyReported) {
          return {
            success: false,
            error: 'You have already reported this user in this session',
          };
        }
      }

      // Create report
      const report = await Report.create(
        reporterId,
        reportedUserId,
        reason,
        description,
        sessionId
      );

      if (!report) {
        return {
          success: false,
          error: 'Failed to create report',
        };
      }

      // Update metrics
      MetricsService.reportsTotal.labels(reason).inc();

      // Check if user should be auto-banned
      await this.checkAutoModeration(reportedUserId);

      logger.info(
        `Report submitted: ${reporterId} reported ${reportedUserId} for ${reason}`
      );

      return {
        success: true,
        message: 'Report submitted successfully',
        reportId: report.id,
      };
    } catch (error) {
      logger.error('Error submitting report:', error);
      return {
        success: false,
        error: 'Internal error',
      };
    }
  }

  // Check if user should be auto-moderated (banned)
  private static async checkAutoModeration(userId: string): Promise<void> {
    try {
      const reportCount = await Report.getReportCount(userId);

      if (reportCount >= this.MAX_REPORTS_THRESHOLD) {
        // Auto-ban user
        await User.setBanStatus(userId, true);

        logger.warn(
          `User ${userId} auto-banned after ${reportCount} reports`
        );
      }
    } catch (error) {
      logger.error('Error in auto-moderation check:', error);
    }
  }

  // Get all reports (admin)
  static async getAllReports(
    page: number = 1,
    limit: number = 20,
    status?: string
  ): Promise<IReportWithDetails[]> {
    try {
      return await Report.getAll(page, limit, status);
    } catch (error) {
      logger.error('Error getting all reports:', error);
      return [];
    }
  }

  // Get reports for a user
  static async getReportsForUser(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<IReportWithDetails[]> {
    try {
      return await Report.getByReportedUser(userId, page, limit);
    } catch (error) {
      logger.error('Error getting reports for user:', error);
      return [];
    }
  }

  // Get reports by a user
  static async getReportsByUser(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<IReportWithDetails[]> {
    try {
      return await Report.getByReporter(userId, page, limit);
    } catch (error) {
      logger.error('Error getting reports by user:', error);
      return [];
    }
  }

  // Update report status (admin action)
  static async updateReportStatus(
    reportId: string,
    status: 'reviewed' | 'resolved' | 'dismissed',
    reviewerId: string
  ): Promise<IReportResult> {
    try {
      const updated = await Report.updateStatus(reportId, status, reviewerId);

      if (!updated) {
        return {
          success: false,
          error: 'Report not found',
        };
      }

      logger.info(`Report ${reportId} status updated to ${status} by ${reviewerId}`);

      return {
        success: true,
        message: 'Report status updated',
      };
    } catch (error) {
      logger.error('Error updating report status:', error);
      return {
        success: false,
        error: 'Internal error',
      };
    }
  }

  // Resolve report and take action
  static async resolveReport(
    reportId: string,
    reviewerId: string,
    action: 'ban' | 'warn' | 'dismiss'
  ): Promise<IReportResult> {
    try {
      const report = await Report.findById(reportId);

      if (!report) {
        return {
          success: false,
          error: 'Report not found',
        };
      }

      // Take action based on decision
      if (action === 'ban') {
        await User.setBanStatus(report.reported_user_id, true);
        logger.info(`User ${report.reported_user_id} banned by admin ${reviewerId}`);
      } else if (action === 'warn') {
        // In future, implement warning system
        logger.info(`User ${report.reported_user_id} warned by admin ${reviewerId}`);
      }

      // Update report status
      const status = action === 'dismiss' ? 'dismissed' : 'resolved';
      await Report.updateStatus(reportId, status, reviewerId);

      return {
        success: true,
        message: `Report ${status} and action taken`,
      };
    } catch (error) {
      logger.error('Error resolving report:', error);
      return {
        success: false,
        error: 'Internal error',
      };
    }
  }

  // Get report statistics
  static async getReportStats(): Promise<any> {
    try {
      const [overallStats, statsByReason, mostReported] = await Promise.all([
        Report.getOverallStats(),
        Report.getStatsByReason(),
        Report.getMostReportedUsers(10),
      ]);

      return {
        overall: overallStats,
        by_reason: statsByReason,
        most_reported: mostReported,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Error getting report stats:', error);
      return null;
    }
  }

  // Get pending reports count
  static async getPendingCount(): Promise<number> {
    try {
      return await Report.getPendingCount();
    } catch (error) {
      logger.error('Error getting pending count:', error);
      return 0;
    }
  }

  // Get recent reports
  static async getRecentReports(limit: number = 20): Promise<IReportWithDetails[]> {
    try {
      return await Report.getRecentReports(limit);
    } catch (error) {
      logger.error('Error getting recent reports:', error);
      return [];
    }
  }

  // Get report details
  static async getReportDetails(reportId: string): Promise<IReportWithDetails | null> {
    try {
      return await Report.getReportWithDetails(reportId);
    } catch (error) {
      logger.error('Error getting report details:', error);
      return null;
    }
  }

  // Check if user can report (rate limiting)
  static async canUserReport(userId: string): Promise<boolean> {
    try {
      const recentReports = await Report.getByReporter(userId, 1, 10);

      if (recentReports.length === 0) {
        return true;
      }

      // Check if last report was within cooldown period
      const lastReport = recentReports[0];
      const timeSinceLastReport = Date.now() - new Date(lastReport.created_at).getTime();

      return timeSinceLastReport > this.REPORT_COOLDOWN;
    } catch (error) {
      logger.error('Error checking if user can report:', error);
      return false;
    }
  }

  // Validate report reason
  static validateReportReason(reason: string): boolean {
    return Object.values(ReportReason).includes(reason as ReportReason);
  }

  // Get user's report history
  static async getUserReportHistory(userId: string): Promise<{
    reports_made: number;
    reports_received: number;
    recent_reports: IReportWithDetails[];
  }> {
    try {
      const [reportsMade, reportsReceived, recentReports] = await Promise.all([
        Report.getByReporter(userId, 1, 100),
        Report.getByReportedUser(userId, 1, 100),
        Report.getRecentReports(5),
      ]);

      return {
        reports_made: reportsMade.length,
        reports_received: reportsReceived.length,
        recent_reports: recentReports,
      };
    } catch (error) {
      logger.error('Error getting user report history:', error);
      return {
        reports_made: 0,
        reports_received: 0,
        recent_reports: [],
      };
    }
  }

  // Bulk resolve reports
  static async bulkResolveReports(
    reportIds: string[],
    reviewerId: string,
    status: 'resolved' | 'dismissed'
  ): Promise<{ success: number; failed: number }> {
    try {
      let success = 0;
      let failed = 0;

      for (const reportId of reportIds) {
        const updated = await Report.updateStatus(reportId, status, reviewerId);
        if (updated) {
          success++;
        } else {
          failed++;
        }
      }

      logger.info(
        `Bulk resolved ${success} reports, ${failed} failed by ${reviewerId}`
      );

      return { success, failed };
    } catch (error) {
      logger.error('Error in bulk resolve:', error);
      return { success: 0, failed: reportIds.length };
    }
  }

  // Clean up old reports
  static async cleanupOldReports(daysOld: number = 90): Promise<number> {
    try {
      const deleted = await Report.deleteOldReports(daysOld);
      
      if (deleted > 0) {
        logger.info(`Cleaned up ${deleted} old reports`);
      }

      return deleted;
    } catch (error) {
      logger.error('Error cleaning up old reports:', error);
      return 0;
    }
  }

  // Get reports for a session
  static async getSessionReports(sessionId: string): Promise<IReportWithDetails[]> {
    try {
      return await Report.getBySession(sessionId);
    } catch (error) {
      logger.error('Error getting session reports:', error);
      return [];
    }
  }
}

export default ReportService;
