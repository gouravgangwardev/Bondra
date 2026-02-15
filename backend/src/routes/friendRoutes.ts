// ============================================
// FILE 4: src/routes/friendRoutes.ts
// ============================================
import { Router } from 'express';
import FriendController from '../controllers/friendController';
// import { authMiddleware } from '../middleware/authMiddleware';
// import { validateRequest } from '../middleware/validator';
// import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();

// All friend routes require authentication
// router.use(authMiddleware); // Uncomment when middleware ready

// Friend list and status
router.get(
  '/',
  FriendController.getFriendList
);

router.get(
  '/online',
  FriendController.getOnlineFriends
);

router.get(
  '/stats',
  FriendController.getFriendStats
);

router.get(
  '/suggestions',
  FriendController.getFriendSuggestions
);

router.get(
  '/:friendId/status',
  // validateRequest('friendId'),
  FriendController.getFriendshipStatus
);

// Friend requests
router.get(
  '/requests/pending',
  FriendController.getPendingRequests
);

router.get(
  '/requests/sent',
  FriendController.getSentRequests
);

router.post(
  '/request',
  // validateRequest('friendRequest'),
  // apiLimiter,
  FriendController.sendFriendRequest
);

router.post(
  '/accept',
  // validateRequest('friendRequest'),
  FriendController.acceptFriendRequest
);

router.post(
  '/reject',
  // validateRequest('friendRequest'),
  FriendController.rejectFriendRequest
);

// Friend management
router.delete(
  '/:friendId',
  // validateRequest('friendId'),
  FriendController.removeFriend
);

router.post(
  '/block',
  // validateRequest('friendRequest'),
  FriendController.blockUser
);

router.delete(
  '/unblock/:friendId',
  // validateRequest('friendId'),
  FriendController.unblockUser
);

export default router;