// Socket.IO em tempo real: chat + sinalização WebRTC (voz, câmera e tela).
// Toda identidade vem do token JWT validado no handshake; nada que o cliente
// envia sobre "quem ele é" é confiável.
const db = require('./db');
const sec = require('./security');
const cfg = require('./config');
const presence = require('./presence');

const MAX_VOICE_PARTICIPANTS = 12;
const VOICE_FLAGS = ['isMuted', 'isDeafened', 'isCameraOn', 'isScreenSharing', 'isSpeaking'];
const STREAM_TYPES = new Set(['cam', 'screen', 'voice']);

// voiceRooms: key -> { serverId: number|null, dmUsers: [a,b]|null, members: Map(socketId -> participant) }
const voiceRooms = new Map();

let io = null;

const publicVoiceUser = (u) => ({
  id: u.id,
  username: u.username,
  display_name: u.display_name,
  avatar_url: u.avatar_url
});

// Chave estável da sala de chamada privada entre dois usuários
const dmRoomKey = (a, b) => `dm:${Math.min(a, b)}:${Math.max(a, b)}`;
function parseDmKey(key) {
  const m = /^dm:([0-9]{1,10}):([0-9]{1,10})$/.exec(key);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!(a > 0 && b > 0 && a < b)) return null;
  return [a, b];
}

function occupantsOf(key) {
  const room = voiceRooms.get(key);
  return room ? Array.from(room.members.values()) : [];
}

function emitOccupants(key) {
  const room = voiceRooms.get(key);
  const payload = { channelId: key, occupants: occupantsOf(key) };
  if (room && room.serverId) io.to(`server_${room.serverId}`).emit('voice_channel_occupants', payload);
  else if (room && room.dmUsers) room.dmUsers.forEach((id) => io.to(`user_${id}`).emit('voice_channel_occupants', payload));
}

function leaveVoice(socket) {
  const key = socket.data.voiceKey;
  if (!key) return;
  socket.data.voiceKey = null;
  const room = voiceRooms.get(key);
  socket.leave(`voice_${key}`);
  if (!room) return;
  room.members.delete(socket.id);
  io.to(`voice_${key}`).emit('user_left_voice', { channelId: key, socketId: socket.id, userId: socket.data.userId });
  const empty = room.members.size === 0;
  if (empty) voiceRooms.delete(key);
  if (room.serverId) io.to(`server_${room.serverId}`).emit('voice_channel_occupants', { channelId: key, occupants: occupantsOf(key) });
  else if (room.dmUsers) {
    room.dmUsers.forEach((id) => io.to(`user_${id}`).emit('voice_channel_occupants', { channelId: key, occupants: occupantsOf(key) }));
    // Quem ligou desistiu antes de atender: pára de tocar para o outro lado.
    if (empty) room.dmUsers.forEach((id) => io.to(`user_${id}`).emit('dm_call_ended', { channelId: key, userId: socket.data.userId }));
  }
}

async function audienceForPresence(userId) {
  const rooms = new Set();
  const friendIds = await db.getAcceptedFriendIds(userId);
  friendIds.forEach((id) => rooms.add(`user_${id}`));
  const servers = await db.getUserServers(userId);
  servers.forEach((s) => rooms.add(`server_${s.id}`));
  return rooms;
}

async function broadcastPresence(userId) {
  try {
    const u = await db.getPublicUser(userId);
    if (!u) return;
    const status = presence.effectiveStatus(userId, u.status_mode);
    const rooms = await audienceForPresence(userId);
    let emitter = io;
    rooms.forEach((r) => { emitter = emitter.to(r); });
    if (rooms.size) emitter.emit('user_status_update', { userId, status_mode: status });
    io.to(`user_${userId}`).emit('user_status_update', { userId, status_mode: status });
  } catch (err) {
    console.error('Erro ao publicar presença:', err.message);
  }
}

function setupSocketIO(ioInstance) {
  io = ioInstance;

  // Autenticação obrigatória no handshake
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      const payload = sec.verifyToken(token);
      if (!payload) return next(new Error('unauthorized'));
      const authUser = await db.getAuthUser(payload.id);
      if (!authUser || (Number(authUser.token_version) || 0) !== payload.tv) return next(new Error('unauthorized'));
      const user = await db.getPublicUser(authUser.id);
      socket.data.userId = user.id;
      socket.data.user = user;
      socket.data.voiceKey = null;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;

    // Fila por socket: eventos async do mesmo cliente são processados em ordem (evita corridas
    // como "join_channel" e "send_message" enviados em sequência).
    let chain = Promise.resolve();
    const buckets = {
      misc: sec.createBucket(60, 20),
      msg: sec.createBucket(10, 2),
      signal: sec.createBucket(400, 200)
    };
    const on = (event, bucket, handler) => {
      socket.on(event, (...args) => {
        const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null;
        if (!buckets[bucket]()) {
          socket.emit('rate_limited', { event });
          if (ack) ack({ ok: false, error: 'rate_limited' });
          return;
        }
        chain = chain
          .then(() => handler(args[0], ack))
          .catch((err) => {
            console.error(`Erro no evento ${event}:`, err.message);
            if (ack) ack({ ok: false, error: 'internal' });
          });
      });
    };

    // Salas pessoais e de servidores
    socket.join(`user_${userId}`);
    try {
      const servers = await db.getUserServers(userId);
      servers.forEach((s) => socket.join(`server_${s.id}`));
    } catch (err) {
      console.error('Erro ao entrar nas salas:', err.message);
    }
    if (presence.add(userId) === 1) broadcastPresence(userId);

    // --- Chat de texto ---
    on('join_channel', 'misc', async (data, ack) => {
      const channelId = sec.toId(data && data.channelId);
      if (!channelId) return ack && ack({ ok: false, error: 'invalid' });
      const access = await db.getChannelAccess(channelId, userId);
      if (!access) return ack && ack({ ok: false, error: 'forbidden' });
      socket.join(`channel_${channelId}`);
      if (ack) ack({ ok: true });
    });

    on('leave_channel', 'misc', async (data) => {
      const channelId = sec.toId(data && data.channelId);
      if (channelId) socket.leave(`channel_${channelId}`);
    });

    on('send_message', 'msg', async (data, ack) => {
      const channelId = sec.toId(data && data.channelId);
      if (!channelId) return ack && ack({ ok: false, error: 'invalid' });
      const checked = sec.sanitizeMessagePayload(data.content, data.attachments);
      if (checked.error) {
        socket.emit('message_error', { error: checked.error });
        return ack && ack({ ok: false, error: checked.error });
      }
      const access = await db.getChannelAccess(channelId, userId);
      if (!access || access.channel.type !== 'text') {
        socket.emit('message_error', { error: 'Sem permissão neste canal.' });
        return ack && ack({ ok: false, error: 'forbidden' });
      }
      const saved = await db.createMessage({ channelId, userId, content: checked.content, attachments: checked.attachments });
      socket.join(`channel_${channelId}`);
      io.to(`channel_${channelId}`).emit('new_message', saved);
      if (ack) ack({ ok: true, id: saved.id });
    });

    const typingGuard = (data) => {
      const channelId = sec.toId(data && data.channelId);
      return channelId && socket.rooms.has(`channel_${channelId}`) ? channelId : null;
    };
    on('typing_start', 'misc', async (data) => {
      const channelId = typingGuard(data);
      if (!channelId) return;
      socket.to(`channel_${channelId}`).emit('user_typing', { channelId, user: publicVoiceUser(socket.data.user) });
    });
    on('typing_stop', 'misc', async (data) => {
      const channelId = typingGuard(data);
      if (!channelId) return;
      socket.to(`channel_${channelId}`).emit('user_stop_typing', { channelId, userId });
    });

    // --- Voz / vídeo / tela ---
    on('join_voice', 'misc', async (data, ack) => {
      const raw = data && data.channelId !== undefined ? String(data.channelId) : '';
      let key;
      let meta;

      if (raw.startsWith('dm:')) {
        const pair = parseDmKey(raw);
        if (!pair || !pair.includes(userId)) return ack && ack({ ok: false, error: 'forbidden' });
        const otherId = pair[0] === userId ? pair[1] : pair[0];
        if (!(await db.areFriends(userId, otherId))) {
          socket.emit('voice_error', { error: 'Você só pode ligar para amigos.' });
          return ack && ack({ ok: false, error: 'forbidden' });
        }
        key = raw;
        meta = { serverId: null, dmUsers: pair, otherId };
      } else {
        const channelId = sec.toId(raw);
        if (!channelId) return ack && ack({ ok: false, error: 'invalid' });
        const access = await db.getChannelAccess(channelId, userId);
        if (!access || access.channel.type !== 'voice') {
          socket.emit('voice_error', { error: 'Sem permissão neste canal de voz.' });
          return ack && ack({ ok: false, error: 'forbidden' });
        }
        key = String(channelId);
        meta = { serverId: access.channel.server_id, dmUsers: null };
      }

      if (socket.data.voiceKey === key) return ack && ack({ ok: true });
      leaveVoice(socket);

      let room = voiceRooms.get(key);
      if (!room) {
        room = { serverId: meta.serverId, dmUsers: meta.dmUsers, members: new Map() };
        voiceRooms.set(key, room);
      }
      const limit = meta.dmUsers ? 2 * 3 : MAX_VOICE_PARTICIPANTS; // até 3 abas/dispositivos por pessoa em DM
      if (room.members.size >= limit) {
        socket.emit('voice_error', { error: 'A sala de voz está cheia.' });
        return ack && ack({ ok: false, error: 'full' });
      }

      const participant = {
        socketId: socket.id,
        user: publicVoiceUser(socket.data.user),
        isMuted: false,
        isDeafened: false,
        isCameraOn: false,
        isScreenSharing: false,
        isSpeaking: false,
        joinedAt: Date.now()
      };
      const existing = Array.from(room.members.values());
      const otherWasAbsent = meta.dmUsers && !existing.some((p) => p.user.id === meta.otherId);
      room.members.set(socket.id, participant);
      socket.join(`voice_${key}`);
      socket.data.voiceKey = key;

      socket.emit('voice_room_users', { channelId: key, users: existing });
      socket.to(`voice_${key}`).emit('user_joined_voice', { channelId: key, participant });
      emitOccupants(key);

      // Chamada privada: toca para o amigo se ele ainda não está na sala.
      if (meta.dmUsers && otherWasAbsent) {
        io.to(`user_${meta.otherId}`).emit('dm_call_incoming', {
          channelId: key,
          from: publicVoiceUser(socket.data.user)
        });
      }
      if (ack) ack({ ok: true });
    });

    on('dm_call_decline', 'misc', async (data) => {
      const otherId = sec.toId(data && data.userId);
      if (!otherId || !(await db.areFriends(userId, otherId))) return;
      io.to(`user_${otherId}`).emit('dm_call_declined', { userId, channelId: dmRoomKey(userId, otherId) });
      io.to(`user_${userId}`).emit('dm_call_ended', { channelId: dmRoomKey(userId, otherId), userId });
    });

    on('webrtc_signal', 'signal', async (data) => {
      if (!data || typeof data !== 'object') return;
      const key = socket.data.voiceKey;
      const room = key && voiceRooms.get(key);
      if (!room || typeof data.targetSocketId !== 'string') return;
      if (!room.members.has(data.targetSocketId) || data.targetSocketId === socket.id) return;
      if (!data.signal || typeof data.signal !== 'object') return;
      if (JSON.stringify(data.signal).length > 60000) return;
      const streamType = STREAM_TYPES.has(data.streamType) ? data.streamType : undefined;
      io.to(data.targetSocketId).emit('webrtc_signal', {
        senderSocketId: socket.id,
        senderUser: publicVoiceUser(socket.data.user),
        signal: data.signal,
        streamType
      });
    });

    on('voice_state_change', 'misc', async (changes) => {
      const key = socket.data.voiceKey;
      const room = key && voiceRooms.get(key);
      if (!room || !room.members.has(socket.id) || !changes || typeof changes !== 'object') return;
      const participant = room.members.get(socket.id);
      const safe = {};
      for (const flag of VOICE_FLAGS) {
        if (typeof changes[flag] === 'boolean') safe[flag] = changes[flag];
      }
      if (!Object.keys(safe).length) return;
      Object.assign(participant, safe);
      io.to(`voice_${key}`).emit('user_voice_state_changed', { socketId: socket.id, userId, changes: safe });
      emitOccupants(key);
    });

    on('leave_voice', 'misc', async () => leaveVoice(socket));

    socket.on('disconnect', () => {
      leaveVoice(socket);
      if (presence.remove(userId) === 0) broadcastPresence(userId);
    });
  });

  return api;
}

// ---------------------------------------------------------------------------
// API usada pelas rotas REST para refletir mudanças em tempo real
// ---------------------------------------------------------------------------
const api = {
  notifyUser: (userId, event, payload) => io && io.to(`user_${userId}`).emit(event, payload),
  notifyServer: (serverId, event, payload) => io && io.to(`server_${serverId}`).emit(event, payload),
  broadcastPresence,
  addUserToServer: (userId, serverId) => io && io.in(`user_${userId}`).socketsJoin(`server_${serverId}`),
  // Remove o usuário das salas do servidor, dos canais e da chamada de voz dele.
  async removeUserFromServer(userId, serverId, channelIds = []) {
    if (!io) return;
    const sockets = await io.in(`user_${userId}`).fetchSockets();
    for (const s of sockets) {
      s.leave(`server_${serverId}`);
      channelIds.forEach((id) => s.leave(`channel_${id}`));
    }
    for (const [key, room] of voiceRooms.entries()) {
      if (room.serverId !== Number(serverId)) continue;
      for (const sid of Array.from(room.members.keys())) {
        const sock = io.sockets.sockets.get(sid);
        if (sock && sock.data.userId === Number(userId)) leaveVoice(sock);
      }
      if (!room.members.size) voiceRooms.delete(key);
    }
  },
  async closeServer(serverId, channelIds = []) {
    if (!io) return;
    io.to(`server_${serverId}`).emit('server_deleted', { serverId: Number(serverId) });
    for (const [key, room] of voiceRooms.entries()) {
      if (room.serverId !== Number(serverId)) continue;
      for (const sid of Array.from(room.members.keys())) {
        const sock = io.sockets.sockets.get(sid);
        if (sock) leaveVoice(sock);
      }
      voiceRooms.delete(key);
    }
    io.in(`server_${serverId}`).socketsLeave(`server_${serverId}`);
    channelIds.forEach((id) => io.in(`channel_${id}`).socketsLeave(`channel_${id}`));
  },
  // Encerra sessões (troca de senha, exclusão de conta, "sair de todos os dispositivos")
  disconnectUser: (userId) => io && io.in(`user_${userId}`).disconnectSockets(true),
  getVoiceOccupants: (key) => occupantsOf(String(key)),
  limits: { MAX_VOICE_PARTICIPANTS },
  cfg
};

module.exports = { setupSocketIO, ...api, dmRoomKey };
