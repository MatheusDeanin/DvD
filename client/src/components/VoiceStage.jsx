import React, { useRef, useEffect, useState } from 'react';
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
  Radio,
  Sparkles,
  Users
} from 'lucide-react';

function PeerTile({ peer, isLocal, voiceState, currentUser }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const user = isLocal ? currentUser : peer.user;
  const isSpeaking = isLocal ? voiceState.isSpeaking : peer.isSpeaking;
  const isMuted = isLocal ? voiceState.isMuted : peer.isMuted;
  const isCameraOn = isLocal ? voiceState.isCameraOn : peer.isCameraOn;
  const stream = isLocal ? voiceState.localStream : peer.stream;

  useEffect(() => {
    if (videoRef.current && stream && isCameraOn) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
    if (audioRef.current && stream && !isLocal) {
      audioRef.current.srcObject = stream;
      audioRef.current.muted = voiceState.isDeafened;
      audioRef.current.play().catch((e) => console.log('Peer audio play:', e));
    }
  }, [stream, isCameraOn, isLocal, voiceState.isDeafened]);

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-discord-darkest flex flex-col items-center justify-center aspect-video border transition-all duration-200 group ${
        isSpeaking ? 'border-discord-green ring-2 ring-discord-green/50 shadow-lg shadow-discord-green/10' : 'border-white/5'
      }`}
    >
      {/* Audio element for remote speech (always mounted so voice is audible) */}
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
          muted={isLocal} // mute local to avoid echo
          className="w-full h-full object-cover"
        />
      ) : (
        /* Avatar fallback when camera is off */
        <div className="flex flex-col items-center justify-center p-4">
          <div className="relative">
            <img
              src={user?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (user?.username || 'user')}
              alt={user?.display_name || user?.username}
              className={`w-20 h-20 rounded-full object-cover transition-transform ${
                isSpeaking ? 'scale-105 ring-4 ring-discord-green' : 'ring-2 ring-white/10'
              }`}
            />
            {isSpeaking && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-discord-green flex items-center justify-center text-black">
                <Volume2 className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Label and badges overlay at bottom */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 shadow">
          <span className="truncate max-w-[120px]">
            {user?.display_name || user?.username || 'Amigo'} {isLocal && '(Você)'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {isMuted && (
            <div className="bg-discord-red/90 p-1 rounded-md text-white shadow">
              <MicOff className="w-3.5 h-3.5" />
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

  // Check if anyone is sharing screen
  const isLocalScreenSharing = voiceState.isScreenSharing;
  const peerSharing = Object.values(voiceState.peers).find((p) => p.isScreenSharing);
  const activeScreenShare = isLocalScreenSharing
    ? { isLocal: true, stream: voiceState.screenStream, user: currentUser }
    : peerSharing
    ? { isLocal: false, stream: peerSharing.screenStream || peerSharing.stream, user: peerSharing.user }
    : null;

  useEffect(() => {
    if (screenShareVideoRef.current && activeScreenShare?.stream) {
      screenShareVideoRef.current.srcObject = activeScreenShare.stream;
      screenShareVideoRef.current.play().catch((err) => console.warn('Erro ao reproduzir tela:', err));
    }
  }, [activeScreenShare]);

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
  const peersMap = { ...(voiceState.peers || {}) };
  if (activeChannel?.occupants) {
    activeChannel.occupants.forEach((occ) => {
      const isMe = String(occ.user?.id) === String(currentUser?.id);
      if (!isMe && occ.socketId && !peersMap[occ.socketId]) {
        peersMap[occ.socketId] = occ;
      }
    });
  }
  const peersList = Object.entries(peersMap);
  const totalCount = peersList.length + 1; // + local

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-discord-chat flex flex-col overflow-hidden relative"
    >
      {/* Top Bar info */}
      <div className="h-12 border-b border-discord-darkest/40 px-4 flex items-center justify-between bg-discord-darkest/30 flex-shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-discord-green" />
          <h2 className="font-bold text-white text-sm">
            {activeChannel ? activeChannel.name : 'Canal de Voz'}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-discord-dark text-discord-muted font-medium flex items-center gap-1">
            <Users className="w-3 h-3" />
            {totalCount}/10 Conectados
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-discord-green font-medium hidden sm:inline-flex items-center gap-1 bg-discord-green/10 px-2 py-0.5 rounded">
            <Sparkles className="w-3 h-3" /> WebRTC P2P Ultra-Low Latency
          </span>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-white/10 text-discord-muted hover:text-white transition"
            title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Content Area: Screen share viewer or Grid */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col items-center justify-center gap-4">
        {/* If someone is sharing screen, show screen prominently */}
        {activeScreenShare ? (
          <div className="w-full flex-1 flex flex-col lg:flex-row gap-4 max-h-full">
            {/* Screen Share Big Box */}
            <div className="flex-1 bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-discord-blurple/30 shadow-2xl">
              <video
                ref={screenShareVideoRef}
                autoPlay
                playsInline
                muted={activeScreenShare.isLocal}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-2 border border-white/10">
                <Monitor className="w-4 h-4 text-discord-blurple" />
                <span>
                  Transmissão ao vivo de {activeScreenShare.user?.display_name || activeScreenShare.user?.username}
                </span>
                <span className="bg-discord-red text-white text-[10px] px-1.5 py-0.2 rounded font-bold uppercase">
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
            {/* Local participant tile */}
            <PeerTile
              isLocal={true}
              voiceState={voiceState}
              currentUser={currentUser}
            />

            {/* Remote participants tiles */}
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

      {/* Floating Control Bar at Bottom (like Discord) */}
      <div className="p-3 bg-discord-darkest/90 backdrop-blur-md border-t border-discord-darkest/50 flex items-center justify-center gap-3 flex-shrink-0 z-20">
        {/* Camera Toggle */}
        <button
          onClick={onToggleCamera}
          className={`p-3 rounded-full transition-all duration-200 flex items-center justify-center ${
            voiceState.isCameraOn
              ? 'bg-discord-green text-black hover:bg-emerald-400'
              : 'bg-discord-input text-white hover:bg-discord-hover'
          }`}
          title={voiceState.isCameraOn ? 'Desligar Câmera' : 'Ligar Câmera'}
        >
          {voiceState.isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={onToggleScreenShare}
          className={`px-4 py-3 rounded-full transition-all duration-200 flex items-center gap-2 font-semibold text-xs ${
            voiceState.isScreenSharing
              ? 'bg-discord-blurple text-white shadow-lg shadow-discord-blurple/40'
              : 'bg-discord-input text-white hover:bg-discord-hover'
          }`}
          title={voiceState.isScreenSharing ? 'Parar Compartilhamento de Tela' : 'Compartilhar Tela (Sem Nitro)'}
        >
          <Monitor className="w-5 h-5" />
          <span className="hidden sm:inline">
            {voiceState.isScreenSharing ? 'Parar Transmissão' : 'Compartilhar Tela'}
          </span>
        </button>

        {/* Mic Mute Toggle */}
        <button
          onClick={onToggleMute}
          className={`p-3 rounded-full transition-all duration-200 flex items-center justify-center ${
            voiceState.isMuted
              ? 'bg-discord-red text-white'
              : 'bg-discord-input text-white hover:bg-discord-hover'
          }`}
          title={voiceState.isMuted ? 'Desativar Mudo' : 'Mutar Microfone'}
        >
          {voiceState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Disconnect Button */}
        <button
          onClick={onLeaveVoice}
          className="p-3 rounded-full bg-discord-red hover:bg-red-600 text-white transition-all duration-200 shadow-lg shadow-discord-red/30 flex items-center justify-center"
          title="Desconectar da chamada"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
