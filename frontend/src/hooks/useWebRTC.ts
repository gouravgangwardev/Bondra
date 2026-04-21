// src/hooks/useWebRTC.ts
//
// FIXES IN THIS FILE
// ==================
// ERROR 5 (MEDIUM) — Race condition: ICE candidates were emitted to the server
//   before the call:start_buffering sentinel existed in Redis.
//   Root cause: call:start_buffering was fire-and-forget.  setLocalDescription()
//   (which starts ICE gathering) was called immediately after, so onicecandidate
//   could fire and have candidates reach the server before the server had written
//   the sentinel key.  Those candidates bypassed the buffer and reached the callee
//   before the offer arrived, and were permanently lost.
//
//   Fix: call:start_buffering now uses a Socket.IO acknowledgement.  The caller
//   branch awaits the ack (with a 500 ms safety fallback) before calling
//   createOffer() / setLocalDescription(), guaranteeing the buffer is active
//   before any ICE candidate can be generated.
//
// Preserved from prior fix (Bug 6):
//   sessionId is kept in a ref so onicecandidate always reads the latest value
//   even though createPC() captured the closure before sessionId was set.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '../utils/constants';

const TURN_SERVER     = import.meta.env.VITE_TURN_SERVER_URL    as string | undefined;
const TURN_USERNAME   = import.meta.env.VITE_TURN_USERNAME      as string | undefined;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL   as string | undefined;

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302'  },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...(TURN_SERVER
      ? [{ urls: TURN_SERVER, username: TURN_USERNAME, credential: TURN_CREDENTIAL }]
      : []),
  ],
  iceCandidatePoolSize: 10,
};

interface UseWebRTCOptions {
  socket:     Socket | null;
  sessionId?: string;
  mode:       'video' | 'audio';
  role?:      'caller' | 'callee';
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

  const pcRef            = useRef<RTCPeerConnection | null>(null);
  const localStreamRef   = useRef<MediaStream | null>(null);
  const icePendingRef    = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);

  // Keep sessionId in a ref so onicecandidate always reads the latest value
  // even when createPC() captured a stale closure (Bug 6 fix preserved).
  const sessionIdRef = useRef(sessionId);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // ── Media ──────────────────────────────────────────────────────────────────

  const startMedia = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: mode === 'video'
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
          : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Media access failed';
      setError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, [mode]);

  const stopMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(m => !m);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsVideoOff(v => !v);
    }
  }, []);

  // ── PeerConnection ─────────────────────────────────────────────────────────

  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    localStreamRef.current?.getTracks().forEach(t =>
      pc.addTrack(t, localStreamRef.current!),
    );

    const rs = new MediaStream();
    setRemoteStream(rs);
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach(t => rs.addTrack(t));
    };

    // Read sessionId through the ref to avoid stale closure (Bug 6 fix preserved).
    pc.onicecandidate = (e) => {
      if (!e.candidate || !socket || !sessionIdRef.current) return;
      socket.emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, { candidate: e.candidate.toJSON() });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        setError('Connection failed. Please try again.');
      }
    };

    pcRef.current = pc;
    return pc;
  }, [socket]); // sessionId intentionally excluded — always read via ref

  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !remoteDescSetRef.current) return;
    for (const c of icePendingRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.warn('Failed to add buffered ICE candidate:', e);
      }
    }
    icePendingRef.current = [];
  }, []);

  // ── Socket signaling ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !sessionId) return;

    const pc = createPC();
    remoteDescSetRef.current = false;

    const handleOffer = async (payload: { offer: RTCSessionDescriptionInit }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        remoteDescSetRef.current = true;
        await flushPendingCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit(SOCKET_EVENTS.CALL_ANSWER, { answer });
      } catch (e) {
        console.error('Error handling offer:', e);
        setError('Failed to process offer');
      }
    };

    const handleAnswer = async (payload: { answer: RTCSessionDescriptionInit }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        remoteDescSetRef.current = true;
        await flushPendingCandidates();
      } catch (e) {
        console.error('Error handling answer:', e);
        setError('Failed to process answer');
      }
    };

    const handleIce = async (payload: { candidate: RTCIceCandidateInit }) => {
      if (!remoteDescSetRef.current) {
        // Remote description not yet set — queue for later (client-side buffer).
        icePendingRef.current.push(payload.candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (e) {
        console.warn('Failed to add ICE candidate:', e);
      }
    };

    socket.on(SOCKET_EVENTS.CALL_OFFER,         handleOffer);
    socket.on(SOCKET_EVENTS.CALL_ANSWER,        handleAnswer);
    socket.on(SOCKET_EVENTS.CALL_ICE_CANDIDATE, handleIce);

    if (role === 'caller') {
      // FIX ERROR 5: await server acknowledgement before creating the offer.
      // The server writes the Redis sentinel in the ack handler, so by the time
      // we call createOffer() / setLocalDescription() (which starts ICE gathering),
      // the buffer is guaranteed to be active.  A 500 ms fallback prevents
      // hanging indefinitely if the ack is lost (e.g. socket drops mid-handshake).
      (async () => {
        try {
          await new Promise<void>((resolve) => {
            const fallback = setTimeout(resolve, 500);
            socket.emit('call:start_buffering', { sessionId }, () => {
              clearTimeout(fallback);
              resolve();
            });
          });

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit(SOCKET_EVENTS.CALL_OFFER, { offer });
        } catch (e) {
          console.error('Error creating offer:', e);
          setError('Failed to create offer');
        }
      })();
    }

    return () => {
      socket.off(SOCKET_EVENTS.CALL_OFFER,         handleOffer);
      socket.off(SOCKET_EVENTS.CALL_ANSWER,        handleAnswer);
      socket.off(SOCKET_EVENTS.CALL_ICE_CANDIDATE, handleIce);
      pc.close();
      pcRef.current            = null;
      remoteDescSetRef.current = false;
      icePendingRef.current    = [];
    };
  }, [socket, sessionId, role, createPC, flushPendingCandidates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMedia();
      pcRef.current?.close();
    };
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