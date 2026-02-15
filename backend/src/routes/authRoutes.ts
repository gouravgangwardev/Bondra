// ============================================
// FILE 2: src/routes/authRoutes.ts
// ============================================
import { Router } from 'express';
import AuthController from '../controllers/authController';
// Import middleware when created
// import { authMiddleware } from '../middleware/authMiddleware';
// import { validateRequest } from '../middleware/validator';
// import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes
router.post(
  '/register',
  // validateRequest('register'), // Uncomment when middleware ready
  // authLimiter, // Rate limit: 5 requests per 15 min
  AuthController.register
);

router.post(
  '/login',
  // validateRequest('login'),
  // authLimiter,
  AuthController.login
);

router.post(
  '/guest',
  // authLimiter,
  AuthController.createGuest
);

router.post(
  '/refresh',
  // validateRequest('refreshToken'),
  AuthController.refreshToken
);

// Protected routes (uncomment when authMiddleware is ready)
router.post(
  '/logout',
  // authMiddleware,
  AuthController.logout
);

router.post(
  '/change-password',
  // authMiddleware,
  // validateRequest('changePassword'),
  AuthController.changePassword
);

router.post(
  '/verify',
  AuthController.verifyToken
);

router.get(
  '/me',
  // authMiddleware,
  AuthController.getCurrentUser
);

export default router;
