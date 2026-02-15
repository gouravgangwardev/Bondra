// ============================================
// FILE 5: src/routes/reportRoutes.ts
// ============================================
import { Router } from 'express';
import ReportController from '../controllers/reportController';
// import { authMiddleware } from '../middleware/authMiddleware';
// import { adminMiddleware } from '../middleware/adminMiddleware';
// import { validateRequest } from '../middleware/validator';
// import { reportLimiter } from '../middleware/rateLimiter';

const router = Router();

// All routes require authentication
// router.use(authMiddleware); // Uncomment when middleware ready

// User routes
router.post(
  '/',
  // validateRequest('submitReport'),
  // reportLimiter, // 1 report per hour
  ReportController.submitReport
);

router.get(
  '/my',
  ReportController.getMyReports
);

// Statistics (public or authenticated)
router.get(
  '/stats',
  ReportController.getReportStats
);

router.get(
  '/pending-count',
  ReportController.getPendingCount
);

// Admin routes (add admin middleware)
router.get(
  '/',
  // adminMiddleware,
  ReportController.getAllReports
);

router.get(
  '/recent',
  // adminMiddleware,
  ReportController.getRecentReports
);

router.get(
  '/user/:userId',
  // adminMiddleware,
  // validateRequest('userId'),
  ReportController.getReportsForUser
);

router.get(
  '/:reportId',
  // validateRequest('reportId'),
  ReportController.getReportDetails
);

router.put(
  '/:reportId/status',
  // adminMiddleware,
  // validateRequest('updateReportStatus'),
  ReportController.updateReportStatus
);

router.post(
  '/:reportId/resolve',
  // adminMiddleware,
  // validateRequest('resolveReport'),
  ReportController.resolveReport
);

export default router;