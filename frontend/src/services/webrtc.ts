// src/services/webrtc.ts
import { socketService } from './socket';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export type MediaMode = 'video' | 'audio';

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private sessionId: string | null = null;
  private mode: MediaMode = 'video';

  // Event handlers
  private onLocalStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateChangeCallback: ((state: RTCPeerConnectionState) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;

  // Initialize WebRTC for a session
  async initialize(sessionId: string, mode: MediaMode = 'video'): Promise<void> {
    this.sessionId = sessionId;
    this.mode = mode;

    try {
      // Get local media
      await this.startLocalMedia();

      // Create peer connection
      this.createPeerConnection();

      // Setup socket event listeners
      this.setupSocketListeners();
    } catch (error: any) {
      console.error('WebRTC initialization error:', error);
      this.onErrorCallback?.(error);
      throw error;
    }
  }

  // Start local camera/microphone
  async startLocalMedia(): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: this.mode === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
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

  // Create RTCPeerConnection
  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming remote tracks
    this.peerConnection.ontrack = (event) => {
      console.log('📹 Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.onRemoteStreamCallback?.(event.streams[0]);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.sessionId) {
        socketService.sendIceCandidate(this.sessionId, event.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState;
      console.log('🔗 Connection state:', state);
      this.onConnectionStateChangeCallback?.(state);

      if (state === 'failed' || state === 'disconnected') {
        this.onErrorCallback?.(new Error('WebRTC connection failed'));
      }
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', this.peerConnection!.iceConnectionState);
    };
  }

  // Setup socket event listeners for signaling
  private setupSocketListeners(): void {
    // Handle incoming offer
    socketService.onOffer(async (data) => {
      try {
        if (!this.peerConnection) return;

        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        if (this.sessionId) {
          socketService.sendAnswer(this.sessionId, answer);
        }
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    // Handle incoming answer
    socketService.onAnswer(async (data) => {
      try {
        if (!this.peerConnection) return;

        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    // Handle incoming ICE candidates
    socketService.onIceCandidate(async (data) => {
      try {
        if (!this.peerConnection) return;

        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });
  }

  // Create and send offer (caller initiates)
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

  // Toggle audio mute
  toggleAudio(): boolean {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // return muted state
    }
    return false;
  }

  // Toggle video
  toggleVideo(): boolean {
    if (!this.localStream || this.mode !== 'video') return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled; // return video off state
    }
    return false;
  }

  // Get current audio mute state
  isAudioMuted(): boolean {
    const audioTrack = this.localStream?.getAudioTracks()[0];
    return audioTrack ? !audioTrack.enabled : false;
  }

  // Get current video state
  isVideoOff(): boolean {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    return videoTrack ? !videoTrack.enabled : false;
  }

  // Switch camera (front/back on mobile)
  async switchCamera(): Promise<void> {
    if (!this.localStream || this.mode !== 'video') return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const constraints = videoTrack.getConstraints();
      const currentFacingMode = constraints.facingMode;
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace track in peer connection
      const sender = this.peerConnection
        ?.getSenders()
        .find(s => s.track?.kind === 'video');

      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      // Replace in local stream
      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newVideoTrack);

      videoTrack.stop();
      this.onLocalStreamCallback?.(this.localStream);
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  }

  // Cleanup and close connection
  cleanup(): void {
    // Stop all tracks
    this.localStream?.getTracks().forEach(track => track.stop());

    // Close peer connection
    this.peerConnection?.close();

    // Reset state
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.sessionId = null;

    // Clear callbacks
    this.onLocalStreamCallback = null;
    this.onRemoteStreamCallback = null;
    this.onConnectionStateChangeCallback = null;
    this.onErrorCallback = null;
  }

  // Event handlers setters
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

  // Getters
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }
}

// Export singleton instance
export const webrtcService = new WebRTCService();

// Export class for testing
export default WebRTCService;