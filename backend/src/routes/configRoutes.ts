// ============================================
// FILE: src/routes/configRoutes.ts - WebRTC Configuration
// ============================================
import { Router } from 'express';

const router = Router();

// WebRTC configuration endpoint
router.get('/webrtc', (req, res) => {
  const config = {
    iceServers: [
      // Free Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
  };

  // Add TURN server if configured (needed for 60-70% of users behind NAT)
  if (process.env.TURN_SERVER_URL) {
    config.iceServers.push({
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_SERVER_USERNAME,
      credential: process.env.TURN_SERVER_CREDENTIAL,
    } as any);
    console.log('✓ TURN server configured');
  } else {
    console.warn('⚠️  TURN server not configured - some users may fail to connect');
  }

  res.json({
    success: true,
    data: config,
  });
});

export default router;
