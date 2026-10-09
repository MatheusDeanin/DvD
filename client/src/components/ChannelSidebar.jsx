import React, { useState } from 'react';
import {
  Hash,
  Volume2,
  Plus,
  Mic,
  MicOff,
  Headphones,
  Settings,
  PhoneOff,
  Radio,
  Copy,
  Check,
  ChevronDown,
  Monitor,
  Video
} from 'lucide-react';

export function ChannelSidebar({
  activeServer,
  channels,
  activeChannelId,
  onSelectChannel,
  onOpenCreateChannel,
  currentUser,
  onOpenProfileSettings,
  // Voice state
  voiceState,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen
}) {
  const [copiedInvite, setCopiedInvite] = useState(false);

  const textChannels = channels.filter((c) => c.type === 'text');
  const voiceChannels = channels.filter((c) => c.type === 'voice');

  const handleCopyInvite = (e) => {
    e.stopPropagation();
    if (activeServer?.invite_code) {
      navigator.clipboard.writeText(activeServer.invite_code);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  const statusColorClass = {
    online: 'bg-discord-green',
    idle: 'bg-discord-yellow',
    dnd: 'bg-discord-red',
    offline: 'bg-discord-muted'
  }[currentUser?.status_mode || 'online'];

  const isConnectedToVoice = !!voiceState?.currentChannelId;
  const currentVoiceChannel = voiceChannels.find(
    (c) => String(c.id) === String(voiceState?.currentChannelId)
  );

  return (
    <div className="w-60 bg-discord-dark flex flex-col select-none flex-shrink-0 border-r border-discord-darkest/40">
      {/* Server Header */}
      <div className="h-12 border-b border-discord-darkest/60 px-4 flex items-center justify-between font-bold text-white shadow-sm hover:bg-white/5 transition cursor-pointer group">
        <span className="truncate">{activeServer ? activeServer.name : 'Mensagens Diretas'}</span>
        {activeServer?.invite_code && (
          <button
            onClick={handleCopyInvite}
            className="flex items-center gap-1 text-[11px] font-medium bg-discord-blurple/20 hover:bg-discord-blurple text-discord-text hover:text-white px-2 py-0.5 rounded transition"
            title="Copiar código de convite do servidor"
          >
            {copiedInvite ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedInvite ? 'Copiado!' : activeServer.invite_code}</span>
          </button>
        )}
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Text Channels Section */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-discord-muted uppercase px-2 mb-1 group">
            <span className="tracking-wider">Canais de Texto</span>
            {activeServer && (
              <button
                onClick={() => onOpenCreateChannel('text')}
                className="hover:text-white transition"
                title="Criar canal de texto"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            {textChannels.map((channel) => {
              const isActive = String(channel.id) === String(activeChannelId);
              return (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition ${
                    isActive
                      ? 'bg-discord-active text-white'
                      : 'text-discord-muted hover:bg-discord-hover hover:text-discord-text'
                  }`}
                >
                  <Hash className="w-4 h-4 text-discord-muted flex-shrink-0" />
                  <span className="truncate">{channel.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Voice Channels Section */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-discord-muted uppercase px-2 mb-1 group">
            <span className="tracking-wider">Canais de Voz (WebRTC)</span>
            {activeServer && (
              <button
                onClick={() => onOpenCreateChannel('voice')}
                className="hover:text-white transition"
                title="Criar canal de voz"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="space-y-1">
            {voiceChannels.map((channel) => {
              const isInThisVoice = String(voiceState?.currentChannelId) === String(channel.id);
              const occupants = channel.occupants || [];

              return (
                <div key={channel.id} className="space-y-0.5">
                  <button
                    onClick={() => onJoinVoice(channel.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm font-medium transition group ${
                      isInThisVoice
                        ? 'bg-discord-green/15 text-discord-green'
                        : 'text-discord-muted hover:bg-discord-hover hover:text-discord-text'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Volume2 className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{channel.name}</span>
                    </div>
                    {isInThisVoice ? (
                      <span className="w-2 h-2 rounded-full bg-discord-green animate-ping" />
                    ) : (
                      occupants.length > 0 && (
                        <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-discord-input text-discord-muted">
                          {occupants.length}
                        </span>
                      )
                    )}
                  </button>

                  {/* Connected members list under channel */}
                  {isInThisVoice && (
                    <div className="pl-6 pr-2 py-1 space-y-1">
                      {/* You */}
                      <div className="flex items-center justify-between text-xs py-0.5 text-discord-text">
                        <div className="flex items-center gap-2 truncate">
                          <img
                            src={currentUser?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                            alt=""
                            className={`w-5 h-5 rounded-full object-cover ${
                              voiceState?.isSpeaking ? 'speaking-ring' : ''
                            }`}
                          />
                          <span className="truncate font-medium">{currentUser?.display_name || currentUser?.username} (Você)</span>
                        </div>
                        <div className="flex items-center gap-1 text-discord-muted">
                          {voiceState?.isMuted && <MicOff className="w-3 h-3 text-discord-red" />}
                          {voiceState?.isCameraOn && <Video className="w-3 h-3 text-discord-green" />}
                          {voiceState?.isScreenSharing && <Monitor className="w-3 h-3 text-discord-blurple" />}
                        </div>
                      </div>

                      {/* Remote peers */}
                      {Object.entries(voiceState?.peers || {}).map(([socketId, peer]) => (
                        <div key={socketId} className="flex items-center justify-between text-xs py-0.5 text-discord-muted hover:text-discord-text">
                          <div className="flex items-center gap-2 truncate">
                            <img
                              src={peer.user?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + socketId}
                              alt=""
                              className={`w-5 h-5 rounded-full object-cover ${
                                peer.isSpeaking ? 'speaking-ring' : ''
                              }`}
                            />
                            <span className="truncate font-medium">{peer.user?.display_name || peer.user?.username || 'Amigo'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {peer.isMuted && <MicOff className="w-3 h-3 text-discord-red" />}
                            {peer.isCameraOn && <Video className="w-3 h-3 text-discord-green" />}
                            {peer.isScreenSharing && <Monitor className="w-3 h-3 text-discord-blurple" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Voice Connection Banner (when active) */}
      {isConnectedToVoice && (
        <div className="bg-discord-darkest/90 border-t border-discord-darkest px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-discord-green animate-pulse" />
            <div>
              <div className="text-xs font-bold text-discord-green flex items-center gap-1">
                Voz Conectada
              </div>
              <div className="text-[11px] text-discord-muted truncate max-w-[120px]">
                {currentVoiceChannel?.name || 'Canal de Voz'}
              </div>
            </div>
          </div>
          <button
            onClick={onLeaveVoice}
            className="p-1.5 rounded-md hover:bg-discord-red/20 text-discord-muted hover:text-discord-red transition"
            title="Desconectar do canal de voz"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* User Bar at Bottom */}
      <div className="h-14 bg-discord-darkest/70 px-2 flex items-center justify-between border-t border-discord-darkest/50">
        <button
          onClick={onOpenProfileSettings}
          className="flex items-center gap-2 p-1 -ml-1 rounded hover:bg-discord-hover transition text-left flex-1 min-w-0 mr-1"
          title="Editar perfil e status"
        >
          <div className="relative flex-shrink-0">
            <img
              src={currentUser?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=me'}
              alt={currentUser?.username}
              className="w-8 h-8 rounded-full object-cover"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-discord-darkest ${statusColorClass}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">
              {currentUser?.display_name || currentUser?.username}
            </div>
            <div className="text-[10px] text-discord-muted truncate">
              {currentUser?.status_text || `#${currentUser?.id || '0001'}`}
            </div>
          </div>
        </button>

        {/* Audio / Settings action icons */}
        <div className="flex items-center gap-0.5 text-discord-muted">
          <button
            onClick={onToggleMute}
            className={`p-1.5 rounded hover:bg-discord-hover hover:text-white transition ${
              voiceState?.isMuted ? 'text-discord-red hover:text-discord-red' : ''
            }`}
            title={voiceState?.isMuted ? 'Desativar Mudo' : 'Ativar Mudo'}
          >
            {voiceState?.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleDeafen}
            className={`p-1.5 rounded hover:bg-discord-hover hover:text-white transition ${
              voiceState?.isDeafened ? 'text-discord-red hover:text-discord-red' : ''
            }`}
            title={voiceState?.isDeafened ? 'Desativar Ensurdecer' : 'Ensurdecer'}
          >
            <Headphones className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenProfileSettings}
            className="p-1.5 rounded hover:bg-discord-hover hover:text-white transition"
            title="Configurações de Usuário"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
