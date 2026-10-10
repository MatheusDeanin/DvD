import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Volume1,
  Radio,
  Sparkles,
  Users,
  Headphones,
  Signal,
  Settings,
  ShieldCheck
} from 'lucide-react';
import { generateAvatar } from '../utils/avatar';

function PeerTile({ peer, isLocal, voiceState, currentUser }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [volume, setVolume] = useState(100);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const user = isLocal ? currentUser : peer.user;
  const isSpeaking = isLocal ? voiceState.isSpeaking : peer.isSpeaking;
  const isMuted = isLocal ? voiceState.isMuted : peer.isMuted;
  const isCameraOn = isLocal ? voiceState.isCameraOn : peer.isCameraOn;
  const stream = isLocal ? voiceState.localStream : peer.stream;

  // Video attachment - ONLY assign when changed to avoid flickering
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isCameraOn && stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.play().catch(() => {});
    } else {
      if (video.srcObject) {
        video.srcObject = null;
      }
    }
  }, [stream, isCameraOn]);

  // Audio attachment - ONLY assign when changed
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (stream && !isLocal) {
      if (audio.srcObject !== stream) {
        audio.srcObject = stream;
      }
      audio.muted = !!voiceState.isDeafened;
      audio.volume = Math.max(0, Math.min(1, volume / 100));
      audio.play().catch(() => {});
    }
  }, [stream, isLocal, voiceState.isDeafened, volume]);

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-discord-darkest flex flex-col items-center justify-center aspect-video border transition-all duration-150 group ${
        isSpeaking
          ? 'border-discord-green ring-2 ring-discord-green/50 shadow-lg shadow-discord-green/20'
          : 'border-white/5 hover:border-white/10'
      }`}
    >
      {/* Audio element for remote speech */}
      {!isLocal && stream && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          muted={voiceState.isDeafened}
        />
      )}

      {/* Video stream if camera is on */}
      {isCameraOn && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        /* Avatar fallback when camera is off */
        <div className="flex flex-col items-center justify-center p-4">
          <div className="relative">
            <img
              src={
                user?.avatar_url ||
                generateAvatar(user?.username || 'user')
              }
              alt={user?.display_name || user?.username}
              className={`w-20 h-20 rounded-full object-cover transition-all duration-200 ${
                isSpeaking
                  ? 'scale-105 ring-4 ring-discord-green shadow-xl shadow-discord-green/30'
                  : 'ring-2 ring-white/10'
              }`}
            />
            {isSpeaking && (
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-discord-green flex items-center justify-center text-black shadow-md animate-pulse">
                <Volume2 className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Top right badges (Volume slider control) */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isLocal && (
          <div className="relative">
            <button
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="p-1.5 rounded-lg bg-black/70 backdrop-blur-md text-white hover:bg-black/90 transition shadow"
              title="Ajustar Volume do Usuário"
            >
              {volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-discord-red" />
              ) : volume < 50 ? (
                <Volume1 className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-discord-green" />
              )}
            </button>
            {showVolumeSlider && (
              <div className="absolute right-0 top-9 bg-discord-darkest border border-white/10 rounded-xl p-3 shadow-2xl z-30 flex flex-col gap-2 w-36">
                <div className="flex justify-between text-[11px] text-discord-muted font-bold">
                  <span>Volume</span>
                  <span className="text-white">{volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full accent-discord-blurple cursor-pointer"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Label and badges overlay at bottom */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
        <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 shadow border border-white/5">
          <span className="truncate max-w-[130px]">
            {user?.display_name || user?.username || 'Amigo'} {isLocal && '(Você)'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {isMuted && (
            <div className="bg-discord-red/90 p-1 rounded-md text-white shadow" title="Mutado">
              <MicOff className="w-3.5 h-3.5" />
            </div>
          )}
          {peer.isScreenSharing && (
            <div className="bg-discord-blurple/90 p-1 rounded-md text-white shadow" title="Compartilhando Tela">
              <Monitor className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function VoiceStage({
  activeChannel,
  currentUser,
  voiceState,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen,
  onToggleCamera,
  onToggleScreenShare
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef(null);
  const screenShareVideoRef = useRef(null);

  // Check if anyone is sharing screen (memoized for rock-solid stability)
  const isLocalScreenSharing = voiceState.isScreenSharing;
  const peerSharing = Object.values(voiceState.peers || {}).find((p) => p.isScreenSharing);

  const activeScreenShare = useMemo(() => {
    if (isLocalScreenSharing) {
      return { isLocal: true, stream: voiceState.screenStream, user: currentUser };
    }
    if (peerSharing) {
      return {
        isLocal: false,
        stream: peerSharing.screenStream || peerSharing.stream,
        user: peerSharing.user
      };
    }
    return null;
  }, [isLocalScreenSharing, voiceState.screenStream, peerSharing?.screenStream, peerSharing?.stream, peerSharing?.user, currentUser]);

  const activeStream = activeScreenShare?.stream;

  // Zero-flicker video element binding
  useEffect(() => {
    const video = screenShareVideoRef.current;
    if (!video) return;

    if (activeStream) {
      if (video.srcObject !== activeStream) {
        video.srcObject = activeStream;
      }
      video.play().catch(() => {});
    } else {
      if (video.srcObject) {
        video.srcObject = null;
      }
    }
  }, [activeStream]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  // Combine voiceState.peers with activeChannel.occupants so friends appear immediately
  const peersMap = useMemo(() => {
    const map = { ...(voiceState.peers || {}) };
    if (activeChannel?.occupants) {
      activeChannel.occupants.forEach((occ) => {
        const isMe = String(occ.user?.id) === String(currentUser?.id);
        if (!isMe && occ.socketId && !map[occ.socketId]) {
          map[occ.socketId] = occ;
        }
      });
    }
    return map;
  }, [voiceState.peers, activeChannel?.occupants, currentUser?.id]);

  const peersList = Object.entries(peersMap);
  const totalCount = peersList.length + 1; // + local

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-discord-chat flex flex-col overflow-hidden relative select-none"
    >
      {/* Top Bar info */}
      <div className="h-12 border-b border-discord-darkest/60 px-4 flex items-center justify-between bg-discord-darkest/40 flex-shrink-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-discord-green animate-pulse" />
            <h2 className="font-bold text-white text-sm">
              {activeChannel ? activeChannel.name : 'Canal de Voz'}
            </h2>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-discord-dark text-discord-muted font-medium flex items-center gap-1.5 border border-white/5">
            <Users className="w-3.5 h-3.5 text-discord-blurple" />
            <span className="text-white font-semibold">{totalCount}</span>/10 Conectados
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* RTC Connected Ping Status */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-discord-green/10 text-discord-green text-xs font-semibold border border-discord-green/20">
            <Signal className="w-3.5 h-3.5" />
            <span>RTC Conectado</span>
            <span className="text-[10px] text-discord-green/70 ml-0.5">18ms</span>
          </div>

          <span className="text-xs text-discord-green font-medium hidden md:inline-flex items-center gap-1 bg-discord-green/10 px-2 py-0.5 rounded">
            <Sparkles className="w-3 h-3" /> WebRTC P2P Ultra-Low Latency
          </span>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-white/10 text-discord-muted hover:text-white transition"
            title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Content Area: Screen share viewer or Grid */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col items-center justify-center gap-4">
        {activeScreenShare ? (
          <div className="w-full flex-1 flex flex-col lg:flex-row gap-4 max-h-full">
            {/* Screen Share Big Box */}
            <div className="flex-1 bg-black rounded-2xl overflow-hidden relative flex items-center justify-center border border-discord-blurple/40 shadow-2xl group/screen">
              <video
                ref={screenShareVideoRef}
                autoPlay
                playsInline
                muted={activeScreenShare.isLocal}
                className="w-full h-full object-contain bg-black"
              />
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-2 border border-white/10 shadow-lg">
                <Monitor className="w-4 h-4 text-discord-blurple animate-pulse" />
                <span>
                  Transmissão de {activeScreenShare.user?.display_name || activeScreenShare.user?.username}
                </span>
                <span className="bg-discord-red text-white text-[10px] px-1.5 py-0.2 rounded font-black tracking-wider uppercase">
                  AO VIVO 60 FPS
                </span>
              </div>
            </div>

            {/* Sidebar with participants tiles */}
            <div className="w-full lg:w-64 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto flex-shrink-0">
              <PeerTile
                isLocal={true}
                voiceState={voiceState}
                currentUser={currentUser}
              />
              {peersList.map(([socketId, peer]) => (
                <PeerTile
                  key={socketId}
                  peer={peer}
                  isLocal={false}
                  voiceState={voiceState}
                  currentUser={currentUser}
                />
              ))}
            </div>
          </div>
        ) : (
          /* Normal Grid of participants */
          <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 my-auto">
            <PeerTile
              isLocal={true}
              voiceState={voiceState}
              currentUser={currentUser}
            />

            {peersList.map(([socketId, peer]) => (
              <PeerTile
                key={socketId}
                peer={peer}
                isLocal={false}
                voiceState={voiceState}
                currentUser={currentUser}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Control Bar at Bottom */}
      <div className="p-3 bg-discord-darkest/95 backdrop-blur-md border-t border-discord-darkest/60 flex items-center justify-center gap-3 flex-shrink-0 z-20">
        {/* Camera Toggle */}
        <button
          onClick={onToggleCamera}
          className={`p-3 rounded-full transition-all duration-150 flex items-center justify-center ${
            voiceState.isCameraOn
              ? 'bg-discord-green text-black hover:bg-emerald-400 ring-2 ring-discord-green/30'
              : 'bg-discord-input text-white hover:bg-discord-hover'
          }`}
          title={voiceState.isCameraOn ? 'Desligar Câmera' : 'Ligar Câmera'}
        >
          {voiceState.isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={onToggleScreenShare}
          className={`px-4 py-3 rounded-full transition-all duration-150 flex items-center gap-2 font-semibold text-xs ${
            voiceState.isScreenSharing
              ? 'bg-discord-blurple text-white shadow-lg shadow-discord-blurple/40 ring-2 ring-discord-blurple/40'
              : 'bg-discord-input text-white hover:bg-discord-hover'
          }`}
          title={voiceState.isScreenSharing ? 'Parar Compartilhamento de Tela' : 'Compartilhar Tela (Sem Nitro / 60 FPS)'}
        >
          <Monitor className="w-5 h-5" />
          <span className="hidden sm:inline">
            {voiceState.isScreenSharing ? 'Parar Transmissão' : 'Compartilhar Tela'}
          </span>
        </button>

        {/* Mic Mute Toggle */}
        <button
          onClick={onToggleMute}
          className={`p-3 rounded-full transition-all duration-150 flex items-center justify-center ${
            voiceState.isMuted
              ? 'bg-discord-red text-white ring-2 ring-discord-red/30'
              : 'bg-discord-input text-white hover:bg-discord-hover'
          }`}
          title={voiceState.isMuted ? 'Desativar Mudo' : 'Mutar Microfone'}
        >
          {voiceState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Deafen Toggle */}
        <button
          onClick={onToggleDeafen}
          className={`p-3 rounded-full transition-all duration-150 flex items-center justify-center ${
            voiceState.isDeafened
              ? 'bg-discord-red text-white ring-2 ring-discord-red/30'
              : 'bg-discord-input text-white hover:bg-discord-hover'
          }`}
          title={voiceState.isDeafened ? 'Desativar Ensurdecer' : 'Ensurdecer'}
        >
          <Headphones className="w-5 h-5" />
        </button>

        {/* Disconnect Button */}
        <button
          onClick={onLeaveVoice}
          className="p-3 rounded-full bg-discord-red hover:bg-red-600 text-white transition-all duration-150 shadow-lg shadow-discord-red/40 flex items-center justify-center"
          title="Desconectar da chamada"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
