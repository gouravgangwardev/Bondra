// src/controllers/reportController.ts
import { Request, Response } from 'express';
import ReportService from '../services/moderation/reportService';
import { logger } from '../utils/logger';
import { HTTP_STATUS, ERROR_CODES, ReportReason, PAGINATION } from '../config/constants';

export class ReportController {
  // Submit a report
  static async submitReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { reportedUserId, reason, description, sessionId } = req.body;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      if (!reportedUserId || !reason) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Reported user ID and reason are required',
        });
        return;
      }

      // Validate reason
      if (!ReportService.validateReportReason(reason)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid report reason',
        });
        return;
      }

      // Check rate limiting
      const canReport = await ReportService.canUserReport(userId);
      if (!canReport) {
        res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
          success: false,
          error: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: 'You can only submit one report per hour',
        });
        return;
      }

      const result = await ReportService.submitReport(
        userId,
        reportedUserId,
        reason as ReportReason,
        description,
        sessionId
      );

      if (!result.success) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: result.error,
        });
        return;
      }

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: result.message,
        data: {
          reportId: result.reportId,
        },
      });
    } catch (error) {
      logger.error('Error in submitReport controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to submit report',
      });
    }
  }

  // Get all reports (admin only)
  static async getAllReports(req: Request, res: Response): Promise<void> {
    try {
      const { 
        page = 1, 
        limit = PAGINATION.DEFAULT_LIMIT,
        status 
      } = req.query;

      const pageNum = Math.max(parseInt(page as string) || 1, 1);
      const limitNum = Math.min(
        parseInt(limit as string) || PAGINATION.DEFAULT_LIMIT,
        PAGINATION.MAX_LIMIT
      );

      const reports = await ReportService.getAllReports(
        pageNum,
        limitNum,
        status as string
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          reports,
          page: pageNum,
          limit: limitNum,
          count: reports.length,
        },
      });
    } catch (error) {
      logger.error('Error in getAllReports controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get reports',
      });
    }
  }

  // Get reports for a user (admin only)
  static async getReportsForUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { page = 1, limit = PAGINATION.DEFAULT_LIMIT } = req.query;

      if (!userId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'User ID is required',
        });
        return;
      }

      const pageNum = Math.max(parseInt(page as string) || 1, 1);
      const limitNum = Math.min(
        parseInt(limit as string) || PAGINATION.DEFAULT_LIMIT,
        PAGINATION.MAX_LIMIT
      );

      const reports = await ReportService.getReportsForUser(
        userId,
        pageNum,
        limitNum
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          reports,
          page: pageNum,
          limit: limitNum,
          count: reports.length,
        },
      });
    } catch (error) {
      logger.error('Error in getReportsForUser controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get reports for user',
      });
    }
  }

  // Get user's own reports
  static async getMyReports(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { page = 1, limit = PAGINATION.DEFAULT_LIMIT } = req.query;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      const pageNum = Math.max(parseInt(page as string) || 1, 1);
      const limitNum = Math.min(
        parseInt(limit as string) || PAGINATION.DEFAULT_LIMIT,
        PAGINATION.MAX_LIMIT
      );

      const reports = await ReportService.getReportsByUser(
        userId,
        pageNum,
        limitNum
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          reports,
          page: pageNum,
          limit: limitNum,
          count: reports.length,
        },
      });
    } catch (error) {
      logger.error('Error in getMyReports controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get reports',
      });
    }
  }

  // Get report details
  static async getReportDetails(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;

      if (!reportId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Report ID is required',
        });
        return;
      }

      const report = await ReportService.getReportDetails(reportId);

      if (!report) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Report not found',
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { report },
      });
    } catch (error) {
      logger.error('Error in getReportDetails controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get report details',
      });
    }
  }

  // Update report status (admin only)
  static async updateReportStatus(req: Request, res: Response): Promise<void> {
    try {
      const reviewerId = (req as any).user?.userId;
      const { reportId } = req.params;
      const { status } = req.body;

      if (!reviewerId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      if (!reportId || !status) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Report ID and status are required',
        });
        return;
      }

      const validStatuses = ['reviewed', 'resolved', 'dismissed'];
      if (!validStatuses.includes(status)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid status',
        });
        return;
      }

      const result = await ReportService.updateReportStatus(
        reportId,
        status,
        reviewerId
      );

      if (!result.success) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: result.error,
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Error in updateReportStatus controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to update report status',
      });
    }
  }

  // Resolve report with action (admin only)
  static async resolveReport(req: Request, res: Response): Promise<void> {
    try {
      const reviewerId = (req as any).user?.userId;
      const { reportId } = req.params;
      const { action } = req.body;

      if (!reviewerId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_CODES.AUTH_UNAUTHORIZED,
          message: 'User not authenticated',
        });
        return;
      }

      if (!reportId || !action) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Report ID and action are required',
        });
        return;
      }

      const validActions = ['ban', 'warn', 'dismiss'];
      if (!validActions.includes(action)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid action',
        });
        return;
      }

      const result = await ReportService.resolveReport(
        reportId,
        reviewerId,
        action
      );

      if (!result.success) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: result.error,
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Error in resolveReport controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to resolve report',
      });
    }
  }

  // Get report statistics
  static async getReportStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await ReportService.getReportStats();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      logger.error('Error in getReportStats controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get report statistics',
      });
    }
  }

  // Get pending reports count
  static async getPendingCount(req: Request, res: Response): Promise<void> {
    try {
      const count = await ReportService.getPendingCount();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { pendingCount: count },
      });
    } catch (error) {
      logger.error('Error in getPendingCount controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get pending count',
      });
    }
  }

  // Get recent reports
  static async getRecentReports(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 20 } = req.query;
      const limitNum = Math.min(parseInt(limit as string) || 20, 100);

      const reports = await ReportService.getRecentReports(limitNum);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          reports,
          count: reports.length,
        },
      });
    } catch (error) {
      logger.error('Error in getRecentReports controller:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get recent reports',
      });
    }
  }
}

export default ReportController;