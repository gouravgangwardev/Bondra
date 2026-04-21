// src/components/chat/index.ts
export { default as TextChat } from './TextChat';
export { default as VideoChat } from './VideoChat';
export { default as AudioChat } from './AudioChat';
export { default as MessageBubble } from './MessageBubble';
export { default as ChatControls } from './ChatControls';
export type { Message, MessageStatus } from './MessageBubble';

// Mode-scoped presentational wrappers
export { default as ChatUI } from './ChatUI';
export type { ChatUIProps } from './ChatUI';
export { default as AudioUI } from './AudioUI';
export type { AudioUIProps } from './AudioUI';
export { default as VideoUI } from './VideoUI';
export type { VideoUIProps } from './VideoUI';
