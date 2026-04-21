// src/services/index.ts
//
// FIXES IN THIS FILE
// ==================
// TS ERROR (ts2614): Module '"./api"' has no exported member 'chatAPI'
//   api.ts exports: authAPI, userAPI, friendsAPI, reportsAPI, healthAPI
//   'chatAPI' was never defined in api.ts — removing it from this barrel export.
//
// ERROR 3 (previous): removed webrtcService singleton export to prevent dual
//   PeerConnection conflict with the useWebRTC hook (preserved from last fix).

export { default as api } from './api';
export { authAPI, userAPI, friendsAPI } from './api';
export { socketService } from './socket';
// chatAPI intentionally removed — it does not exist in api.ts (ts2614).
// webrtcService intentionally NOT exported — Chat.tsx uses the useWebRTC hook.