// src/hooks/useWebRTC.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface UseWebRTCOptions {
  socket: Socket | null;
  sessionId?: string;
  mode: 'video' | 'audio';
}

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isConnecting: boolean;
  error: string | null;
  startMedia: () => Promise<void>;
  stopMedia: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = (options: UseWebRTCOptions): UseWebRTCReturn => {
  const { socket, sessionId, mode } = options;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Start local media (camera/microphone)
  const startMedia = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: mode === 'video' ? { width: 1280, height: 720 } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setIsConnecting(false);
    } catch (err: any) {
      console.error('Error accessing media devices:', err);
      setError(err.message || 'Failed to access camera/microphone');
      setIsConnecting(false);
    }
  }, [mode]);

  // Stop local media
  const stopMedia = useCallback(() => {
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
  }, [localStream]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream && mode === 'video') {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, [localStream, mode]);

  // Setup WebRTC peer connection
  useEffect(() => {
    if (!socket || !sessionId || !localStream) return;

    const peerConnection = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = peerConnection;

    // Add local tracks to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Handle incoming remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:ice-candidate', {
          sessionId,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed') {
        setError('WebRTC connection failed');
      }
    };

    // Listen for WebRTC signaling events
    socket.on('webrtc:offer', async (data: { offer: RTCSessionDescriptionInit }) => {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('webrtc:answer', { sessionId, answer });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    });

    socket.on('webrtc:answer', async (data: { answer: RTCSessionDescriptionInit }) => {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (err) {
        console.error('Error handling answer:', err);
      }
    });

    socket.on('webrtc:ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });

    // Create and send offer
    const createOffer = async () => {
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('webrtc:offer', { sessionId, offer });
      } catch (err) {
        console.error('Error creating offer:', err);
      }
    };

    createOffer();

    // Cleanup
    return () => {
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
      peerConnection.close();
      peerConnectionRef.current = null;
    };
  }, [socket, sessionId, localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMedia();
      peerConnectionRef.current?.close();
    };
  }, [stopMedia]);

  return {
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isConnecting,
    error,
    startMedia,
    stopMedia,
    toggleMute,
    toggleVideo,
  };
};
