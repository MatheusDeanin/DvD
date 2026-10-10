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
import { FriendsView } from './components/FriendsView';
import { DirectMessageChat } from './components/DirectMessageChat';
import { RemoteAudioListener } from './components/RemoteAudioListener';
import { useWebRTC } from './hooks/useWebRTC';
import { generateAvatar } from './utils/avatar';
import { playRingSound } from './utils/audio';

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

  // Friends & Direct Messages
  const [friends, setFriends] = useState([]);
  const [activeDMUser, setActiveDMUser] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);

  // Modals & Panels
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [createChannelDefaultType, setCreateChannelDefaultType] = useState('text');
  const [showMembers, setShowMembers] = useState(true);
  const [keepAliveStatus, setKeepAliveStatus] = useState(null);

  const [incomingCall, setIncomingCall] = useState(null);

  // Socket
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);

  // Initialize WebRTC with reactive socket state
  const voiceState = useWebRTC(socket, currentUser);

  // 1. Initial Auth Check from LocalStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('discord_token');
    const savedUser = localStorage.getItem('discord_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {}

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
    if (!currentUser || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      auth: { token }
    });
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket conectado!', newSocket.id);
    });

    newSocket.on('new_message', (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });

    newSocket.on('new_dm', (newDm) => {
      setDmMessages((prev) => {
        if (prev.some((m) => m.id === newDm.id)) return prev;
        return [...prev, newDm];
      });
    });

    newSocket.on('friend_request_received', () => {
      loadFriends();
    });

    newSocket.on('friend_request_accepted', () => {
      loadFriends();
    });

    newSocket.on('user_typing', ({ user }) => {
      setTypingUsers((prev) => {
        if (prev.some((u) => u.id === user.id)) return prev;
        return [...prev, user];
      });
    });

    newSocket.on('user_stop_typing', ({ userId }) => {
      setTypingUsers((prev) => prev.filter((u) => u.id !== userId));
    });

    newSocket.on('voice_channel_occupants', ({ channelId, occupants }) => {
      setChannels((prev) =>
        prev.map((ch) =>
          String(ch.id) === String(channelId) ? { ...ch, occupants } : ch
        )
      );
    });

    newSocket.on('channel_created', ({ serverId, channel }) => {
      if (String(serverId) === String(activeServerId)) {
        setChannels((prev) => [...prev, channel]);
      }
    });

    newSocket.on('user_status_update', ({ userId, status_mode }) => {
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, status_mode } : m))
      );
      setFriends((prev) =>
        prev.map((f) => (f.user?.id === userId ? { ...f, user: { ...f.user, status_mode } } : f))
      );
    });

    newSocket.on('dm_call_incoming', (callInfo) => {
      setIncomingCall(callInfo);
      // Aqui você poderia tocar um som de "Ring" chamando...
    });

    newSocket.on('dm_call_ended', (data) => {
      setIncomingCall((prev) => {
        if (prev && prev.channelId === data.channelId) return null;
        return prev;
      });
    });

    newSocket.on('dm_call_declined', (data) => {
      // Opcional: mostrar um toast dizendo que o amigo recusou a chamada
    });

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [currentUser?.id, token]);

  // Ringing sound effect loop
  useEffect(() => {
    if (incomingCall) {
      playRingSound();
      const interval = setInterval(() => playRingSound(), 2000);
      return () => clearInterval(interval);
    }
  }, [incomingCall]);

  // 3. Fetch Keep-Alive status periodically (apenas quando logado)
  useEffect(() => {
    if (!token) return;
    const fetchStatus = () => {
      fetch('/api/keep-alive/status', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (data) setKeepAliveStatus(data); })
        .catch(() => {});
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [token]);

  // 4. Fetch User's Servers & Friends
  const loadFriends = () => {
    if (!token) return;
    fetch('/api/friends', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.friends) setFriends(data.friends);
      })
      .catch((err) => console.error('Erro ao carregar amigos:', err));
  };

  useEffect(() => {
    if (!token) return;

    fetch('/api/servers', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.servers) {
          setServers(data.servers);
        }
        if (!activeServerId) {
          setActiveServerId('home');
        }
      })
      .catch((err) => console.error('Erro ao carregar servidores:', err));

    loadFriends();
  }, [token]);

  // 5. When activeServerId changes, fetch channels and members
  useEffect(() => {
    if (!token || !activeServerId || activeServerId === 'home') {
      if (activeServerId === 'home') {
        loadFriends();
      }
      return;
    }

    // Reset DM view when entering a server
    setActiveDMUser(null);

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
    if (!token || !activeChannelId || activeServerId === 'home') return;

    const currentChannel = channels.find((c) => String(c.id) === String(activeChannelId));
    if (currentChannel && currentChannel.type === 'voice') {
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
  }, [token, activeChannelId, channels, activeServerId]);

  // 7. When activeDMUser changes, fetch DMs
  useEffect(() => {
    if (!token || !activeDMUser) return;

    fetch(`/api/dms/${activeDMUser.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) setDmMessages(data.messages);
      })
      .catch((err) => console.error('Erro ao carregar mensagens diretas:', err));
  }, [token, activeDMUser]);

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

  const handleSendDM = async (content, attachments) => {
    if (!token || !activeDMUser) return;
    try {
      const res = await fetch(`/api/dms/${activeDMUser.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content, attachments })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err) {
      console.error('Erro ao enviar DM:', err);
    }
  };

  const handleSendFriendRequest = async (username) => {
    const res = await fetch('/api/friends/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao enviar pedido');
    loadFriends();
    return data;
  };

  const handleAcceptFriendRequest = async (friendshipId) => {
    const res = await fetch(`/api/friends/${friendshipId}/accept`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) loadFriends();
  };

  const handleRemoveFriend = async (friendshipId) => {
    const res = await fetch(`/api/friends/${friendshipId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      loadFriends();
      if (activeDMUser) setActiveDMUser(null);
    }
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
    if (!token) return;
    const res = await fetch('/api/keep-alive/trigger', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
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

  const isHome = activeServerId === 'home' || !activeServerId;
  const activeServer = servers.find((s) => String(s.id) === String(activeServerId));
  const activeChannel = channels.find((c) => String(c.id) === String(activeChannelId));
  const isViewingVoiceStage = activeChannel?.type === 'voice' || (voiceState.currentChannelId && activeChannelId === voiceState.currentChannelId);

  return (
    <div className="w-screen h-screen flex bg-discord-darkest overflow-hidden text-discord-text select-none">
      {/* Background persistent audio listener for all remote peers */}
      <RemoteAudioListener peers={voiceState.peers} isDeafened={voiceState.isDeafened} />

      {/* 1. Login / Register / Forgot Password Modal */}
      {!currentUser && <AuthModal onLoginSuccess={handleLoginSuccess} />}

      {/* 2. Leftmost Server Sidebar */}
      <ServerSidebar
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={(id) => {
          setActiveServerId(id);
          if (id === 'home') {
            setActiveDMUser(null);
          }
        }}
        onOpenCreateServer={() => setShowCreateServerModal(true)}
        onOpenKeepAliveModal={() => setShowProfileModal(true)}
        keepAliveStatus={keepAliveStatus}
      />

      {/* 3. Channels and User Bar Sidebar */}
      <ChannelSidebar
        activeServer={isHome ? 'home' : activeServer}
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
        // Friends & DMs
        friends={friends}
        activeDMUserId={activeDMUser?.id}
        onSelectDM={(friendUser) => setActiveDMUser(friendUser)}
        onSelectFriendsTab={() => setActiveDMUser(null)}
      />

      {/* 4. Main Stage / Chat / Friends Area */}
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
      ) : isHome ? (
        activeDMUser ? (
          <DirectMessageChat
            friend={activeDMUser}
            messages={dmMessages}
            onSendMessage={handleSendDM}
            onBackToFriends={() => setActiveDMUser(null)}
            onStartVoiceCall={() => {
              const voiceCh = channels.find((c) => c.type === 'voice');
              if (voiceCh) {
                setActiveChannelId(voiceCh.id);
                voiceState.joinVoice(voiceCh.id);
              } else if (servers.length > 0) {
                fetch(`/api/servers/${servers[0].id}/channels`, {
                  headers: { Authorization: `Bearer ${token}` }
                })
                  .then((res) => res.json())
                  .then((data) => {
                    const firstVoice = data.channels?.find((c) => c.type === 'voice');
                    if (firstVoice) {
                      setActiveServerId(servers[0].id);
                      setChannels(data.channels);
                      setActiveChannelId(firstVoice.id);
                      voiceState.joinVoice(firstVoice.id);
                    } else {
                      alert('Crie um canal de voz no servidor para iniciar uma chamada!');
                    }
                  })
                  .catch(() => alert('Não foi possível conectar à chamada.'));
              }
            }}
            currentUser={currentUser}
          />
        ) : (
          <FriendsView
            friends={friends}
            currentUser={currentUser}
            onSendFriendRequest={handleSendFriendRequest}
            onAcceptRequest={handleAcceptFriendRequest}
            onRemoveFriend={handleRemoveFriend}
            onSelectDM={(friendUser) => setActiveDMUser(friendUser)}
          />
        )
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
      {showMembers && !isViewingVoiceStage && !isHome && (
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

      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in select-none">
          <div className="bg-discord-dark rounded-xl shadow-2xl border border-white/10 p-6 flex flex-col items-center max-w-sm w-full">
            <img
              src={incomingCall.from.avatar_url || generateAvatar(incomingCall.from.username)}
              alt={incomingCall.from.username}
              className="w-20 h-20 rounded-full mb-4 ring-4 ring-discord-darkest animate-pulse"
            />
            <h2 className="text-xl font-bold text-white mb-1">Chamada Recebida</h2>
            <p className="text-sm text-discord-muted mb-6">
              <strong className="text-white">{incomingCall.from.display_name || incomingCall.from.username}</strong> está te ligando...
            </p>
            <div className="flex items-center gap-4 w-full">
              <button
                onClick={() => {
                  socket.emit('dm_call_decline', { userId: incomingCall.from.id });
                  setIncomingCall(null);
                }}
                className="flex-1 py-2.5 rounded-lg bg-discord-red hover:bg-discord-red/80 font-semibold text-white transition shadow"
              >
                Recusar
              </button>
              <button
                onClick={() => {
                  setActiveServerId('home');
                  setActiveDMUser(incomingCall.from);
                  voiceState.joinVoice(incomingCall.channelId);
                  setIncomingCall(null);
                }}
                className="flex-1 py-2.5 rounded-lg bg-discord-green hover:bg-discord-green/80 font-semibold text-black transition shadow"
              >
                Atender
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
