import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

export function useWebRTC(socket, currentUser) {
  const [currentChannelId, setCurrentChannelId] = useState(null);
  const [peers, setPeers] = useState({}); // socketId -> { user, isMuted, isCameraOn, isScreenSharing, isSpeaking, stream, screenStream }
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioError, setAudioError] = useState(null);

  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef({}); // socketId -> RTCPeerConnection
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Stop all local tracks
  const cleanupMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    peerConnectionsRef.current = {};
    setPeers({});
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setIsSpeaking(false);
  }, []);

  // Voice Activity Detection (Speaking detection)
  const setupVoiceActivityDetection = useCallback((stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let speakingState = false;

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const nowSpeaking = average > 18;

        if (nowSpeaking !== speakingState) {
          speakingState = nowSpeaking;
          setIsSpeaking(nowSpeaking);
          if (socket) {
            socket.emit('voice_state_change', { isSpeaking: nowSpeaking });
          }
        }
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (e) {
      console.warn('Voice Activity Detection error:', e);
    }
  }, [socket]);

  // Create Peer Connection with a target user
  const createPeerConnection = useCallback((targetSocketId, targetUser, isInitiator = false) => {
    if (peerConnectionsRef.current[targetSocketId]) {
      return peerConnectionsRef.current[targetSocketId];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[targetSocketId] = pc;

    // Add local tracks (audio/cam)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Add screen track if sharing
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, screenStreamRef.current);
      });
    }

    // ICE Candidate
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc_signal', {
          targetSocketId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    // Remote Track received
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setPeers((prev) => {
        const existing = prev[targetSocketId] || { user: targetUser };
        // Check if track is video and likely a screen share or camera
        return {
          ...prev,
          [targetSocketId]: {
            ...existing,
            user: targetUser || existing.user,
            stream: remoteStream,
          },
        };
      });
    };

    // Create and send offer if initiator
    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (socket) {
            socket.emit('webrtc_signal', {
              targetSocketId,
              signal: pc.localDescription,
            });
          }
        })
        .catch((err) => console.error('Error creating offer:', err));
    }

    return pc;
  }, [socket]);

  // Join Voice Channel
  const joinVoice = useCallback(async (channelId) => {
    if (currentChannelId === channelId) return;
    cleanupMedia();
    setCurrentChannelId(channelId);
    setAudioError(null);

    try {
      // Get user audio (mic)
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch (mediaErr) {
        console.warn('Microphone permission not granted or device unavailable:', mediaErr);
        setAudioError('Microfone não acessível ou sem permissão. Você pode ouvir os outros.');
        // Create silent audio stream fallback so WebRTC still works
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const dst = osc.connect(ctx.createMediaStreamDestination());
        stream = dst.stream;
      }

      localStreamRef.current = stream;
      setupVoiceActivityDetection(stream);

      // Tell server we joined
      if (socket) {
        socket.emit('join_voice', { channelId, user: currentUser });
      }
    } catch (err) {
      console.error('Failed to join voice channel:', err);
    }
  }, [currentChannelId, cleanupMedia, currentUser, setupVoiceActivityDetection, socket]);

  // Leave Voice Channel
  const leaveVoice = useCallback(() => {
    if (socket) {
      socket.emit('leave_voice');
    }
    cleanupMedia();
    setCurrentChannelId(null);
  }, [cleanupMedia, socket]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMuteState = !audioTrack.enabled;
        setIsMuted(newMuteState);
        if (socket) {
          socket.emit('voice_state_change', { isMuted: newMuteState });
        }
      }
    }
  }, [socket]);

  // Toggle Deafen
  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev;
      // If deafened, mute as well
      if (next && !isMuted) {
        toggleMute();
      }
      if (socket) {
        socket.emit('voice_state_change', { isDeafened: next });
      }
      return next;
    });
  }, [isMuted, toggleMute, socket]);

  // Toggle Camera
  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      // Turn off camera
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
          localStreamRef.current.removeTrack(videoTrack);
          // Remove from peer connections
          Object.values(peerConnectionsRef.current).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track === videoTrack);
            if (sender) pc.removeTrack(sender);
          });
        }
      }
      setIsCameraOn(false);
      if (socket) socket.emit('voice_state_change', { isCameraOn: false });
    } else {
      // Turn on camera
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        });
        const videoTrack = camStream.getVideoTracks()[0];
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
        } else {
          localStreamRef.current = camStream;
        }

        // Add to peer connections
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          pc.addTrack(videoTrack, localStreamRef.current);
          // Renegotiate
          pc.createOffer().then((offer) => pc.setLocalDescription(offer)).then(() => {
            const targetSocketId = Object.keys(peerConnectionsRef.current).find(
              (key) => peerConnectionsRef.current[key] === pc
            );
            if (targetSocketId && socket) {
              socket.emit('webrtc_signal', { targetSocketId, signal: pc.localDescription });
            }
          });
        });

        setIsCameraOn(true);
        if (socket) socket.emit('voice_state_change', { isCameraOn: true });
      } catch (err) {
        console.error('Failed to open camera:', err);
        alert('Não foi possível acessar a câmera: ' + err.message);
      }
    }
  }, [isCameraOn, socket]);

  // Toggle Screen Share
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      if (socket) socket.emit('voice_state_change', { isScreenSharing: false });
    } else {
      // Start sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor',
            frameRate: { max: 60 },
          },
          audio: true, // system audio if supported by browser
        });

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Handle user clicking "Stop Sharing" on browser banner
        screenTrack.onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
          if (socket) socket.emit('voice_state_change', { isScreenSharing: false });
        };

        // Add screen track to all peer connections
        Object.entries(peerConnectionsRef.current).forEach(([targetSocketId, pc]) => {
          pc.addTrack(screenTrack, screenStream);
          pc.createOffer().then((offer) => pc.setLocalDescription(offer)).then(() => {
            if (socket) {
              socket.emit('webrtc_signal', { targetSocketId, signal: pc.localDescription });
            }
          });
        });

        setIsScreenSharing(true);
        if (socket) socket.emit('voice_state_change', { isScreenSharing: true });
      } catch (err) {
        console.error('Failed to share screen:', err);
      }
    }
  }, [isScreenSharing, socket]);

  // Socket Events listener for WebRTC Signaling
  useEffect(() => {
    if (!socket) return;

    // Existing peers in the voice room
    const handleVoiceRoomUsers = ({ users }) => {
      users.forEach((existingUser) => {
        setPeers((prev) => ({
          ...prev,
          [existingUser.socketId]: existingUser,
        }));
        // We are the newcomer, so initiate peer connection with existing peer
        createPeerConnection(existingUser.socketId, existingUser.user, true);
      });
    };

    // Another user joined
    const handleUserJoinedVoice = ({ participant }) => {
      setPeers((prev) => ({
        ...prev,
        [participant.socketId]: participant,
      }));
      // Wait for their offer or create peer connection
      createPeerConnection(participant.socketId, participant.user, false);
    };

    // User left voice
    const handleUserLeftVoice = ({ socketId }) => {
      if (peerConnectionsRef.current[socketId]) {
        peerConnectionsRef.current[socketId].close();
        delete peerConnectionsRef.current[socketId];
      }
      setPeers((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    // WebRTC Signaling packet (Offer / Answer / Candidate)
    const handleWebRTCSignal = async ({ senderSocketId, senderUser, signal }) => {
      let pc = peerConnectionsRef.current[senderSocketId];
      if (!pc) {
        pc = createPeerConnection(senderSocketId, senderUser, false);
      }

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc_signal', {
            targetSocketId: senderSocketId,
            signal: pc.localDescription,
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.type === 'candidate' && signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error('Error handling WebRTC signal:', err);
      }
    };

    // Peer voice state update (mute, cam, screenshare, speaking)
    const handleVoiceStateChanged = ({ socketId, changes }) => {
      setPeers((prev) => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: {
            ...prev[socketId],
            ...changes,
          },
        };
      });
    };

    socket.on('voice_room_users', handleVoiceRoomUsers);
    socket.on('user_joined_voice', handleUserJoinedVoice);
    socket.on('user_left_voice', handleUserLeftVoice);
    socket.on('webrtc_signal', handleWebRTCSignal);
    socket.on('user_voice_state_changed', handleVoiceStateChanged);

    return () => {
      socket.off('voice_room_users', handleVoiceRoomUsers);
      socket.off('user_joined_voice', handleUserJoinedVoice);
      socket.off('user_left_voice', handleUserLeftVoice);
      socket.off('webrtc_signal', handleWebRTCSignal);
      socket.off('user_voice_state_changed', handleVoiceStateChanged);
    };
  }, [socket, createPeerConnection]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  return {
    currentChannelId,
    peers,
    isMuted,
    isDeafened,
    isCameraOn,
    isScreenSharing,
    isSpeaking,
    audioError,
    localStream: localStreamRef.current,
    screenStream: screenStreamRef.current,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
  };
}
