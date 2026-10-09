import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { ServerSidebar } from './components/ServerSidebar';
import { ChannelSidebar } from './components/ChannelSidebar';
import { ChatArea } from './components/ChatArea';
import { VoiceStage } from './components/VoiceStage';
import { MemberList } from './components/MemberList';
import { AuthModal } from './components/AuthModal';
import { UserSettingsModal } from './components/UserSettingsModal';
import { CreateServerModal } from './components/CreateServerModal';
import { CreateChannelModal } from './components/CreateChannelModal';
import { useWebRTC } from './hooks/useWebRTC';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Core Data
  const [servers, setServers] = useState([]);
  const [activeServerId, setActiveServerId] = useState(null);
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  // Modals & Panels
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [createChannelDefaultType, setCreateChannelDefaultType] = useState('text');
  const [showMembers, setShowMembers] = useState(true);
  const [keepAliveStatus, setKeepAliveStatus] = useState(null);

  // Socket
  const socketRef = useRef(null);

  // Initialize WebRTC
  const voiceState = useWebRTC(socketRef.current, currentUser);

  // 1. Initial Auth Check from LocalStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('discord_token');
    const savedUser = localStorage.getItem('discord_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {}

      // Verify token with backend
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` }
      })
        .then((res) => {
          if (!res.ok) throw new Error('Token expirado');
          return res.json();
        })
        .then((data) => {
          if (data.user) {
            setCurrentUser(data.user);
            localStorage.setItem('discord_user', JSON.stringify(data.user));
          }
        })
        .catch(() => {
          localStorage.removeItem('discord_token');
          localStorage.removeItem('discord_user');
          setToken(null);
          setCurrentUser(null);
        })
        .finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []);

  // 2. Setup Socket.IO connection when authenticated
  useEffect(() => {
    if (!currentUser || !token) return;

    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket conectado!', socket.id);
      socket.emit('register_user', currentUser);
    });

    socket.on('new_message', (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });

    socket.on('user_typing', ({ user }) => {
      setTypingUsers((prev) => {
        if (prev.some((u) => u.id === user.id)) return prev;
        return [...prev, user];
      });
    });

    socket.on('user_stop_typing', ({ userId }) => {
      setTypingUsers((prev) => prev.filter((u) => u.id !== userId));
    });

    socket.on('voice_channel_occupants', ({ channelId, occupants }) => {
      setChannels((prev) =>
        prev.map((ch) =>
          String(ch.id) === String(channelId) ? { ...ch, occupants } : ch
        )
      );
    });

    socket.on('channel_created', ({ serverId, channel }) => {
      if (String(serverId) === String(activeServerId)) {
        setChannels((prev) => [...prev, channel]);
      }
    });

    socket.on('user_status_update', ({ userId, status_mode }) => {
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, status_mode } : m))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser?.id, token]);

  // 3. Fetch Keep-Alive status periodically
  useEffect(() => {
    const fetchStatus = () => {
      fetch('/api/keep-alive/status')
        .then((res) => res.json())
        .then((data) => setKeepAliveStatus(data))
        .catch(() => {});
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // 4. Fetch User's Servers
  useEffect(() => {
    if (!token) return;

    fetch('/api/servers', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.servers && data.servers.length > 0) {
          setServers(data.servers);
          if (!activeServerId) {
            setActiveServerId(data.servers[0].id);
          }
        }
      })
      .catch((err) => console.error('Erro ao carregar servidores:', err));
  }, [token]);

  // 5. When activeServerId changes, fetch channels and members
  useEffect(() => {
    if (!token || !activeServerId || activeServerId === 'home') return;

    // Fetch channels
    fetch(`/api/servers/${activeServerId}/channels`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.channels) {
          setChannels(data.channels);
          const firstText = data.channels.find((c) => c.type === 'text');
          if (firstText) {
            setActiveChannelId(firstText.id);
          }
        }
      })
      .catch((err) => console.error('Erro ao carregar canais:', err));

    // Fetch members
    fetch(`/api/servers/${activeServerId}/members`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.members) {
          setMembers(data.members);
        }
      })
      .catch((err) => console.error('Erro ao carregar membros:', err));
  }, [token, activeServerId]);

  // 6. When activeChannelId changes, join socket channel room & fetch messages
  useEffect(() => {
    if (!token || !activeChannelId) return;

    const currentChannel = channels.find((c) => String(c.id) === String(activeChannelId));
    if (currentChannel && currentChannel.type === 'voice') {
      // Voice channel selected
      return;
    }

    if (socketRef.current) {
      socketRef.current.emit('join_channel', { channelId: activeChannelId });
    }

    fetch(`/api/channels/${activeChannelId}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          setMessages(data.messages);
        }
      })
      .catch((err) => console.error('Erro ao carregar mensagens:', err));

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_channel', { channelId: activeChannelId });
      }
    };
  }, [token, activeChannelId, channels]);

  // Handlers
  const handleLoginSuccess = (user, jwtToken) => {
    setCurrentUser(user);
    setToken(jwtToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('discord_token');
    localStorage.removeItem('discord_user');
    setCurrentUser(null);
    setToken(null);
    setShowProfileModal(false);
    voiceState.leaveVoice();
  };

  const handleSendMessage = (content, attachments) => {
    if (!socketRef.current || !activeChannelId) return;
    socketRef.current.emit('send_message', {
      channelId: activeChannelId,
      content,
      attachments
    });
  };

  const handleTyping = (isTyping) => {
    if (!socketRef.current || !activeChannelId) return;
    if (isTyping) {
      socketRef.current.emit('typing_start', { channelId: activeChannelId });
    } else {
      socketRef.current.emit('typing_stop', { channelId: activeChannelId });
    }
  };

  const handleUpdateProfile = async (updates) => {
    const res = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao atualizar perfil');
    setCurrentUser(data.user);
    localStorage.setItem('discord_user', JSON.stringify(data.user));
    return data.user;
  };

  const handleCreateServer = async ({ name, iconUrl }) => {
    const res = await fetch('/api/servers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name, iconUrl })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao criar servidor');
    setServers((prev) => [...prev, data.server]);
    setActiveServerId(data.server.id);
  };

  const handleJoinServer = async (inviteCode) => {
    const res = await fetch('/api/servers/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ inviteCode })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao entrar no servidor');
    setServers((prev) => {
      if (prev.some((s) => s.id === data.server.id)) return prev;
      return [...prev, data.server];
    });
    setActiveServerId(data.server.id);
  };

  const handleCreateChannel = async ({ name, type, topic }) => {
    const res = await fetch(`/api/servers/${activeServerId}/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name, type, topic })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao criar canal');
    setChannels((prev) => [...prev, data.channel]);
    if (data.channel.type === 'text') {
      setActiveChannelId(data.channel.id);
    }
  };

  const handleTriggerPing = async () => {
    const res = await fetch('/api/keep-alive/trigger', { method: 'POST' });
    const data = await res.json();
    if (data.status) setKeepAliveStatus(data.status);
    return data;
  };

  if (!authChecked) {
    return (
      <div className="w-screen h-screen bg-discord-darkest flex items-center justify-center text-white">
        <div className="w-8 h-8 border-4 border-discord-blurple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeServer = servers.find((s) => String(s.id) === String(activeServerId));
  const activeChannel = channels.find((c) => String(c.id) === String(activeChannelId));
  const isViewingVoiceStage = activeChannel?.type === 'voice' || (voiceState.currentChannelId && activeChannelId === voiceState.currentChannelId);

  return (
    <div className="w-screen h-screen flex bg-discord-darkest overflow-hidden text-discord-text select-none">
      {/* 1. Login / Register Modal if not authenticated */}
      {!currentUser && <AuthModal onLoginSuccess={handleLoginSuccess} />}

      {/* 2. Leftmost Server Sidebar */}
      <ServerSidebar
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={(id) => setActiveServerId(id)}
        onOpenCreateServer={() => setShowCreateServerModal(true)}
        onOpenKeepAliveModal={() => setShowProfileModal(true)}
        keepAliveStatus={keepAliveStatus}
      />

      {/* 3. Channels and User Bar Sidebar */}
      <ChannelSidebar
        activeServer={activeServer}
        channels={channels}
        activeChannelId={activeChannelId}
        onSelectChannel={(chId) => setActiveChannelId(chId)}
        onOpenCreateChannel={(type) => {
          setCreateChannelDefaultType(type);
          setShowCreateChannelModal(true);
        }}
        currentUser={currentUser}
        onOpenProfileSettings={() => setShowProfileModal(true)}
        voiceState={voiceState}
        onJoinVoice={(chId) => {
          setActiveChannelId(chId);
          voiceState.joinVoice(chId);
        }}
        onLeaveVoice={() => voiceState.leaveVoice()}
        onToggleMute={() => voiceState.toggleMute()}
        onToggleDeafen={() => voiceState.toggleDeafen()}
      />

      {/* 4. Main Stage / Chat Area */}
      {isViewingVoiceStage ? (
        <VoiceStage
          activeChannel={activeChannel}
          currentUser={currentUser}
          voiceState={voiceState}
          onLeaveVoice={() => voiceState.leaveVoice()}
          onToggleMute={() => voiceState.toggleMute()}
          onToggleDeafen={() => voiceState.toggleDeafen()}
          onToggleCamera={() => voiceState.toggleCamera()}
          onToggleScreenShare={() => voiceState.toggleScreenShare()}
        />
      ) : (
        <ChatArea
          activeChannel={activeChannel}
          messages={messages}
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
          typingUsers={typingUsers}
          currentUser={currentUser}
          onToggleMembers={() => setShowMembers(!showMembers)}
          showMembers={showMembers}
        />
      )}

      {/* 5. Members List (Right Side) */}
      {showMembers && !isViewingVoiceStage && (
        <MemberList members={members} currentUserId={currentUser?.id} />
      )}

      {/* User Settings Modal */}
      {showProfileModal && (
        <UserSettingsModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onUpdateProfile={handleUpdateProfile}
          onLogout={handleLogout}
          keepAliveStatus={keepAliveStatus}
          onTriggerPing={handleTriggerPing}
        />
      )}

      {/* Create / Join Server Modal */}
      {showCreateServerModal && (
        <CreateServerModal
          onClose={() => setShowCreateServerModal(false)}
          onCreateServer={handleCreateServer}
          onJoinServer={handleJoinServer}
        />
      )}

      {/* Create Channel Modal */}
      {showCreateChannelModal && (
        <CreateChannelModal
          defaultType={createChannelDefaultType}
          onClose={() => setShowCreateChannelModal(false)}
          onCreateChannel={handleCreateChannel}
        />
      )}
    </div>
  );
}
