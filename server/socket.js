// Socket.IO Real-time Handler: Chat + WebRTC Voice, Video & Screen Sharing
const db = require('./db');

// In-memory mapping of voice channel participants
// voiceRooms[channelId] = Map(socketId => { socketId, user, isMuted, isDeafened, isCameraOn, isScreenSharing, isSpeaking })
const voiceRooms = new Map();

// Map socketId -> { userId, currentVoiceChannelId, user }
const socketUserMap = new Map();

function setupSocketIO(io) {
  io.on('connection', (socket) => {
    // Authenticate / Register user socket
    socket.on('register_user', (userData) => {
      if (!userData || !userData.id) return;
      socketUserMap.set(socket.id, {
        userId: userData.id,
        user: userData,
        currentVoiceChannelId: null
      });
      // Join a personal user room for direct notifications
      socket.join(`user_${userData.id}`);
      io.emit('user_status_update', {
        userId: userData.id,
        status_mode: userData.status_mode || 'online'
      });
    });

    // --- TEXT CHAT ROOMS ---
    socket.on('join_channel', ({ channelId }) => {
      socket.join(`channel_${channelId}`);
    });

    socket.on('leave_channel', ({ channelId }) => {
      socket.leave(`channel_${channelId}`);
    });

    socket.on('send_message', async ({ channelId, content, attachments }) => {
      const userInfo = socketUserMap.get(socket.id);
      if (!userInfo) return;

      try {
        const savedMessage = await db.createMessage({
          channelId,
          userId: userInfo.userId,
          content,
          attachments: attachments || []
        });

        // Broadcast new message to everyone in the channel
        io.to(`channel_${channelId}`).emit('new_message', savedMessage);
      } catch (err) {
        console.error('Erro ao enviar mensagem:', err);
        socket.emit('message_error', { error: 'Falha ao salvar mensagem.' });
      }
    });

    socket.on('typing_start', ({ channelId }) => {
      const userInfo = socketUserMap.get(socket.id);
      if (!userInfo) return;
      socket.to(`channel_${channelId}`).emit('user_typing', {
        channelId,
        user: userInfo.user
      });
    });

    socket.on('typing_stop', ({ channelId }) => {
      const userInfo = socketUserMap.get(socket.id);
      if (!userInfo) return;
      socket.to(`channel_${channelId}`).emit('user_stop_typing', {
        channelId,
        userId: userInfo.userId
      });
    });

    // --- WEBRTC VOICE & VIDEO ROOMS ---
    socket.on('join_voice', ({ channelId, user }) => {
      // Leave previous voice room if in one
      leaveCurrentVoice(socket, io);

      if (!voiceRooms.has(channelId)) {
        voiceRooms.set(channelId, new Map());
      }
      const room = voiceRooms.get(channelId);

      const participant = {
        socketId: socket.id,
        user: user || { id: socket.id, display_name: 'Amigo', username: 'amigo' },
        isMuted: false,
        isDeafened: false,
        isCameraOn: false,
        isScreenSharing: false,
        isSpeaking: false,
        joinedAt: Date.now()
      };

      // Get existing participants before adding the new one
      const existingUsers = Array.from(room.values());

      room.set(socket.id, participant);
      socket.join(`voice_${channelId}`);

      const userInfo = socketUserMap.get(socket.id) || {};
      userInfo.currentVoiceChannelId = channelId;
      userInfo.user = participant.user;
      socketUserMap.set(socket.id, userInfo);

      // Send to the newcomer the list of all peers already in the room
      socket.emit('voice_room_users', {
        channelId,
        users: existingUsers
      });

      // Notify existing users that newcomer joined
      socket.to(`voice_${channelId}`).emit('user_joined_voice', {
        channelId,
        participant
      });

      // Also announce channel occupants count to everyone
      io.emit('voice_channel_occupants', {
        channelId,
        occupants: Array.from(room.values())
      });
    });

    // WebRTC Signaling Relay (Offers, Answers, ICE Candidates)
    socket.on('webrtc_signal', ({ targetSocketId, signal, streamType }) => {
      const senderInfo = socketUserMap.get(socket.id);
      io.to(targetSocketId).emit('webrtc_signal', {
        senderSocketId: socket.id,
        senderUser: senderInfo ? senderInfo.user : null,
        signal,
        streamType // 'cam' | 'screen' | 'voice'
      });
    });

    // Voice State Changes (Mic mute, Camera toggle, Screen share toggle, Speaking active)
    socket.on('voice_state_change', (changes) => {
      const userInfo = socketUserMap.get(socket.id);
      if (!userInfo || !userInfo.currentVoiceChannelId) return;

      const channelId = userInfo.currentVoiceChannelId;
      const room = voiceRooms.get(channelId);
      if (room && room.has(socket.id)) {
        const participant = room.get(socket.id);
        Object.assign(participant, changes);
        room.set(socket.id, participant);

        // Broadcast updated state to room members
        io.to(`voice_${channelId}`).emit('user_voice_state_changed', {
          socketId: socket.id,
          userId: userInfo.userId,
          changes
        });
      }
    });

    socket.on('leave_voice', () => {
      leaveCurrentVoice(socket, io);
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      leaveCurrentVoice(socket, io);
      const userInfo = socketUserMap.get(socket.id);
      if (userInfo) {
        io.emit('user_status_update', {
          userId: userInfo.userId,
          status_mode: 'offline'
        });
        socketUserMap.delete(socket.id);
      }
    });
  });
}

function leaveCurrentVoice(socket, io) {
  const userInfo = socketUserMap.get(socket.id);
  if (!userInfo || !userInfo.currentVoiceChannelId) return;

  const channelId = userInfo.currentVoiceChannelId;
  userInfo.currentVoiceChannelId = null;

  const room = voiceRooms.get(channelId);
  if (room) {
    room.delete(socket.id);
    socket.leave(`voice_${channelId}`);

    io.to(`voice_${channelId}`).emit('user_left_voice', {
      channelId,
      socketId: socket.id,
      userId: userInfo.userId
    });

    io.emit('voice_channel_occupants', {
      channelId,
      occupants: Array.from(room.values())
    });

    if (room.size === 0) {
      voiceRooms.delete(channelId);
    }
  }
}

function getVoiceOccupants(channelId) {
  const room = voiceRooms.get(parseInt(channelId)) || voiceRooms.get(String(channelId));
  return room ? Array.from(room.values()) : [];
}

module.exports = {
  setupSocketIO,
  getVoiceOccupants
};
