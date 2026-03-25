// ============================================
// FILE: src/routes/index.ts - Route Aggregator (MODIFIED)
// ============================================
import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import friendRoutes from './friendRoutes';
import reportRoutes from './reportRoutes';
import healthRoutes from './healthRoutes';
import configRoutes from './configRoutes'; // ✅ ADDED

const router = Router();

// Mount all routes with their base paths
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/friends', friendRoutes);
router.use('/reports', reportRoutes);
router.use('/health', healthRoutes);
router.use('/config', configRoutes); // ✅ ADDED

// Root API endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Random Chat API v1',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      friends: '/api/v1/friends',
      reports: '/api/v1/reports',
      health: '/api/v1/health',
      config: '/api/v1/config', // ✅ ADDED
    },
    documentation: 'https://docs.randomchat.com',
  });
});

export default router;
