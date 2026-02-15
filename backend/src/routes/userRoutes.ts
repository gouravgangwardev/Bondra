// ============================================
// FILE 3: src/routes/userRoutes.ts
// ============================================
import { Router } from 'express';
import UserController from '../controllers/userController';
// import { authMiddleware } from '../middleware/authMiddleware';
// import { validateRequest } from '../middleware/validator';
// import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes
router.get(
  '/search',
  // apiLimiter,
  UserController.searchUsers
);

router.get(
  '/active-count',
  UserController.getActiveUsersCount
);

router.get(
  '/check-username',
  UserController.checkUsername
);

// Protected routes
router.get(
  '/profile/:userId',
  // authMiddleware,
  UserController.getUserProfile
);

router.put(
  '/profile',
  // authMiddleware,
  // validateRequest('updateProfile'),
  UserController.updateProfile
);

router.get(
  '/stats',
  // authMiddleware,
  UserController.getUserStats
);

router.put(
  '/last-seen',
  // authMiddleware,
  UserController.updateLastSeen
);

router.delete(
  '/account',
  // authMiddleware,
  // validateRequest('deleteAccount'),
  UserController.deleteAccount
);

// Admin routes (add admin middleware later)
router.get(
  '/',
  // authMiddleware,
  // adminMiddleware,
  UserController.getAllUsers
);

export default router;