// src/services/index.ts
export { default as api } from './api';
export { authAPI, userAPI, friendsAPI, chatAPI } from './api';
export { socketService } from './socket';
export { webrtcService } from './webrtc';