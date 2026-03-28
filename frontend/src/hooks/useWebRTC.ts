// src/hooks/useWebRTC.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { ICE_SERVERS, SOCKET_EVENTS } from '../utils/constants';

interface UseWebRTCOptions {
  socket:     Socket | null;
  sessionId?: string;
  mode:       'video' | 'audio';
  role?:      'caller' | 'callee'; // caller creates & sends the offer
}

interface UseWebRTCReturn {
  localStream:   MediaStream | null;
  remoteStream:  MediaStream | null;
  isMuted:       boolean;
  isVideoOff:    boolean;
  isConnecting:  boolean;
  error:         string | null;
  startMedia:    () => Promise<void>;
  stopMedia:     () => void;
  toggleMute:    () => void;
  toggleVideo:   () => void;
}

export const useWebRTC = ({
  socket,
  sessionId,
  mode,
  role = 'caller',
}: UseWebRTCOptions): UseWebRTCReturn => {
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted,      setIsMuted]      = useState(false);
  const [isVideoOff,   setIsVideoOff]   = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // ── Media helpers ──────────────────────────────────────────────────────────

  const startMedia = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: mode === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
    } catch (err: any) {
      console.error('getUserMedia error:', err);
      setError(err.message || `Failed to access ${mode === 'video' ? 'camera' : 'microphone'}`);
    } finally {
      setIsConnecting(false);
    }
  }, [mode]);

  const stopMedia = useCallback(() => {
    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
  }, [localStream]);

  const toggleMute = useCallback(() => {
    const track = localStream?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (mode !== 'video') return;
    const track = localStream?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsVideoOff(!track.enabled);
    }
  }, [localStream, mode]);

  // ── Peer connection + signaling ────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !sessionId || !localStream) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
    peerConnectionRef.current = pc;

    // Add local tracks
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // Remote stream
    pc.ontrack = (event) => {
      if (event.streams?.[0]) setRemoteStream(event.streams[0]);
    };

    // ICE — backend event: call:ice  payload: { sessionId, candidate }
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, { sessionId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') setError('WebRTC connection failed. Check your network.');
      if (pc.connectionState === 'connected') setIsConnecting(false);
    };

    // ── Signaling listeners ──────────────────────────────────────────────────

    // backend emits: call:offer  { offer, senderId }
    const onOffer = async (data: { offer: RTCSessionDescriptionInit }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        // backend event: call:answer  payload: { sessionId, answer }
        socket.emit(SOCKET_EVENTS.CALL_ANSWER, { sessionId, answer });
      } catch (err) {
        console.error('Error handling offer:', err);
        setError('Failed to handle connection offer');
      }
    };

    // backend emits: call:answer  { answer, senderId }
    const onAnswer = async (data: { answer: RTCSessionDescriptionInit }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (err) {
        console.error('Error handling answer:', err);
      }
    };

    // backend emits: call:ice  { candidate, senderId }
    const onIce = async (data: { candidate: RTCIceCandidateInit }) => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    };

    socket.on(SOCKET_EVENTS.CALL_OFFER,         onOffer);
    socket.on(SOCKET_EVENTS.CALL_ANSWER,        onAnswer);
    socket.on(SOCKET_EVENTS.CALL_ICE_CANDIDATE, onIce);

    // ── The caller initiates the offer ───────────────────────────────────────
    if (role === 'caller') {
      setIsConnecting(true);
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          // backend event: call:offer  payload: { sessionId, offer }
          socket.emit(SOCKET_EVENTS.CALL_OFFER, { sessionId, offer });
        } catch (err) {
          console.error('Error creating offer:', err);
          setError('Failed to initiate call');
          setIsConnecting(false);
        }
      })();
    }

    return () => {
      socket.off(SOCKET_EVENTS.CALL_OFFER,         onOffer);
      socket.off(SOCKET_EVENTS.CALL_ANSWER,        onAnswer);
      socket.off(SOCKET_EVENTS.CALL_ICE_CANDIDATE, onIce);
      pc.close();
      peerConnectionRef.current = null;
    };
  }, [socket, sessionId, localStream, role]);

  // Cleanup on unmount
  useEffect(() => () => {
    stopMedia();
    peerConnectionRef.current?.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
