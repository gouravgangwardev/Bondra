// src/services/webrtc.ts
//
// FIX ERROR 3 (HIGH) — Socket listeners leaked on every cleanup() call,
//   accumulating duplicate handlers across multiple sessions (Next → new match).
//
//   Root cause: setupSocketListeners() registered handlers via
//   socketService.on('call:offer' | 'call:answer' | 'call:ice', anonymousCb).
//   The anonymous callbacks were never stored, so cleanup() had no references
//   to pass to socketService.off().  After each initialize() the old listeners
//   remained alive on the socket.  On the second match there were 2 offer
//   handlers, both calling setRemoteDescription on potentially different
//   RTCPeerConnection instances, causing SDP state-machine errors and broken
//   connections.
//
//   Fix: store the three listener references as private class fields.
//   setupSocketListeners() calls removeSocketListeners() first (idempotent tear-
//   down), then creates named functions and registers them.
//   cleanup() now calls removeSocketListeners() before doing anything else.

import { socketService } from './socket';

const TURN_SERVER    = import.meta.env.VITE_TURN_SERVER_URL;
const TURN_USERNAME  = import.meta.env.VITE_TURN_USERNAME;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL;

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // TURN server — required for users behind symmetric NAT (~20% of connections).
    // Set VITE_TURN_* in your .env. Free tier: https://www.metered.ca/tools/openrelay/
    ...(TURN_SERVER
      ? [
          {
            urls:       TURN_SERVER,
            username:   TURN_USERNAME,
            credential: TURN_CREDENTIAL,
          },
        ]
      : []),
  ],
  iceCandidatePoolSize: 10,
};

export type MediaMode = 'video' | 'audio';

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream:    MediaStream | null = null;
  private remoteStream:   MediaStream | null = null;
  private sessionId:      string | null = null;
  private mode:           MediaMode = 'video';

  // Event handlers (user-facing callbacks)
  private onLocalStreamCallback:            ((stream: MediaStream) => void) | null = null;
  private onRemoteStreamCallback:           ((stream: MediaStream) => void) | null = null;
  private onConnectionStateChangeCallback:  ((state: RTCPeerConnectionState) => void) | null = null;
  private onErrorCallback:                  ((error: Error) => void) | null = null;

  // FIX ERROR 3: store socket listener references so they can be removed later.
  private offerHandler:        ((data: { offer: RTCSessionDescriptionInit }) => Promise<void>) | null = null;
  private answerHandler:       ((data: { answer: RTCSessionDescriptionInit }) => Promise<void>) | null = null;
  private iceCandidateHandler: ((data: { candidate: RTCIceCandidateInit }) => Promise<void>) | null = null;

  // ── Public API ─────────────────────────────────────────────────────────────

  async initialize(sessionId: string, mode: MediaMode = 'video'): Promise<void> {
    this.sessionId = sessionId;
    this.mode      = mode;

    try {
      await this.startLocalMedia();
      this.createPeerConnection();
      this.setupSocketListeners();   // removes stale listeners before registering new ones
    } catch (error: any) {
      console.error('WebRTC initialization error:', error);
      this.onErrorCallback?.(error);
      throw error;
    }
  }

  async startLocalMedia(): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
        },
        video: this.mode === 'video'
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
          : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      this.onLocalStreamCallback?.(stream);
      return stream;
    } catch (error: any) {
      console.error('Error accessing media devices:', error);
      throw new Error(`Failed to access ${this.mode}: ${error.message}`);
    }
  }

  async createOffer(): Promise<void> {
    try {
      if (!this.peerConnection || !this.sessionId) return;

      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.mode === 'video',
      });

      await this.peerConnection.setLocalDescription(offer);
      socketService.sendOffer(this.sessionId, offer);
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  toggleAudio(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // return muted state
    }
    return false;
  }

  toggleVideo(): boolean {
    if (!this.localStream || this.mode !== 'video') return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled; // return video-off state
    }
    return false;
  }

  isAudioMuted(): boolean {
    const audioTrack = this.localStream?.getAudioTracks()[0];
    return audioTrack ? !audioTrack.enabled : false;
  }

  isVideoOff(): boolean {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    return videoTrack ? !videoTrack.enabled : false;
  }

  async switchCamera(): Promise<void> {
    if (!this.localStream || this.mode !== 'video') return;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const constraints       = videoTrack.getConstraints();
      const currentFacingMode = constraints.facingMode;
      const newFacingMode     = currentFacingMode === 'user' ? 'environment' : 'user';

      const newStream     = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      const sender = this.peerConnection
        ?.getSenders()
        .find(s => s.track?.kind === 'video');

      if (sender) await sender.replaceTrack(newVideoTrack);

      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newVideoTrack);
      videoTrack.stop();
      this.onLocalStreamCallback?.(this.localStream);
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  }

  // FIX ERROR 3: cleanup() now removes socket listeners before tearing down the
  // PeerConnection, preventing stale handlers from accumulating across sessions.
  cleanup(): void {
    this.removeSocketListeners();   // ← must come first

    this.localStream?.getTracks().forEach(track => track.stop());
    this.peerConnection?.close();

    this.peerConnection = null;
    this.localStream    = null;
    this.remoteStream   = null;
    this.sessionId      = null;

    this.onLocalStreamCallback           = null;
    this.onRemoteStreamCallback          = null;
    this.onConnectionStateChangeCallback = null;
    this.onErrorCallback                 = null;
  }

  // ── Callback setters ───────────────────────────────────────────────────────

  onLocalStream(callback: (stream: MediaStream) => void): void {
    this.onLocalStreamCallback = callback;
  }

  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
  }

  onConnectionStateChange(callback: (state: RTCPeerConnectionState) => void): void {
    this.onConnectionStateChangeCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  getLocalStream():  MediaStream | null { return this.localStream;  }
  getRemoteStream(): MediaStream | null { return this.remoteStream; }
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    this.peerConnection.ontrack = (event) => {
      console.log('📹 Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.onRemoteStreamCallback?.(event.streams[0]);
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.sessionId) {
        socketService.sendIceCandidate(this.sessionId, event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState;
      console.log('🔗 Connection state:', state);
      this.onConnectionStateChangeCallback?.(state);

      if (state === 'failed' || state === 'disconnected') {
        this.onErrorCallback?.(new Error('WebRTC connection failed'));
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', this.peerConnection!.iceConnectionState);
    };
  }

  // FIX ERROR 3: store named functions in class fields; call removeSocketListeners()
  // first so multiple initialize() calls never stack up duplicate handlers.
  private setupSocketListeners(): void {
    this.removeSocketListeners(); // always tear down before re-registering

    this.offerHandler = async (data) => {
      try {
        if (!this.peerConnection) return;
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.offer),
        );
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        if (this.sessionId) socketService.sendAnswer(this.sessionId, answer);
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    };

    this.answerHandler = async (data) => {
      try {
        if (!this.peerConnection) return;
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.answer),
        );
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    };

    this.iceCandidateHandler = async (data) => {
      try {
        if (!this.peerConnection) return;
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(data.candidate),
        );
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    };

    socketService.on('call:offer',  this.offerHandler);
    socketService.on('call:answer', this.answerHandler);
    socketService.on('call:ice',    this.iceCandidateHandler);
  }

  // FIX ERROR 3: remove stored listeners and null the refs so they are not
  // removed twice if cleanup() is called more than once.
  private removeSocketListeners(): void {
    if (this.offerHandler) {
      socketService.off('call:offer', this.offerHandler);
      this.offerHandler = null;
    }
    if (this.answerHandler) {
      socketService.off('call:answer', this.answerHandler);
      this.answerHandler = null;
    }
    if (this.iceCandidateHandler) {
      socketService.off('call:ice', this.iceCandidateHandler);
      this.iceCandidateHandler = null;
    }
  }
}

// Export singleton instance
export const webrtcService = new WebRTCService();

// Export class for testing
export default WebRTCService;