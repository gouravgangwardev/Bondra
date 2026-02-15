// ============================================
// FILE 6: src/routes/healthRoutes.ts
// ============================================
import { Router } from 'express';
import HealthController from '../controllers/healthController';
// import { adminMiddleware } from '../middleware/adminMiddleware';

const router = Router();

// Public health checks (for load balancers)
router.get(
  '/',
  HealthController.healthCheck
);

router.get(
  '/live',
  HealthController.livenessCheck
);

router.get(
  '/ready',
  HealthController.readinessCheck
);

// Detailed health (may want to restrict in production)
router.get(
  '/detailed',
  HealthController.detailedHealthCheck
);

// System information (restrict to admins in production)
router.get(
  '/system',
  // adminMiddleware,
  HealthController.getSystemStats
);

router.get(
  '/app',
  // adminMiddleware,
  HealthController.getAppStats
);

// Component-specific health checks
router.get(
  '/cache',
  HealthController.getCacheStats
);

router.get(
  '/database',
  HealthController.getDatabaseStats
);

router.get(
  '/queue',
  HealthController.getQueueStats
);

router.get(
  '/cluster',
  HealthController.getClusterInfo
);

// Maintenance endpoints (admin only)
router.post(
  '/cache/reset',
  // adminMiddleware,
  HealthController.resetCacheStats
);

export default router;