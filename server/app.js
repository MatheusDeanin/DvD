// Aplicação Express do DvD (API REST + arquivos estáticos do cliente).
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const cfg = require('./config');

const adminConfig = { projectId: 'dvd-app-45586' };
if (cfg.FIREBASE_CREDENTIALS) {
  adminConfig.credential = admin.credential.cert(cfg.FIREBASE_CREDENTIALS);
}

admin.initializeApp(adminConfig);
const sec = require('./security');
const db = require('./db');
const presence = require('./presence');
const socketApi = require('./socket');
const { getKeepAliveStatus, executePing } = require('./keepAlive');

const { HttpError, asyncHandler, limiters } = sec;

const RESERVED_USERNAMES = new Set(['admin', 'administrator', 'root', 'system', 'dvd', 'suporte', 'support', 'moderator', 'mod', 'staff', 'null', 'undefined']);
const DUMMY_HASH = bcrypt.hashSync('dvd-dummy-password-for-timing-equalization', cfg.BCRYPT_COST);
const RECOVERY_CODE_COUNT = 8;

const bodyOf = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});
const str = (v) => (typeof v === 'string' ? v : null);

const publicSelf = (u) => ({
  id: u.id,
  username: u.username,
  display_name: u.display_name,
  avatar_url: u.avatar_url,
  banner_color: u.banner_color,
  bio: u.bio,
  status_mode: u.status_mode,
  status_text: u.status_text,
  friend_code: u.friend_code,
  created_at: u.created_at
});
const publicLite = (u) => ({ id: u.id, username: u.username, display_name: u.display_name, avatar_url: u.avatar_url });

function createApp() {
  const app = express();
  const server = http.createServer(app);

  app.disable('x-powered-by');
  app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

  const io = new Server(server, {
    // Sem CORS: o cliente é servido da mesma origem. Origens extras só via ALLOWED_ORIGINS.
    allowRequest: (req, cb) => cb(null, sec.isOriginAllowed(req.headers.origin, req.headers.host)),
    maxHttpBufferSize: 3 * 1024 * 1024,
    pingTimeout: 30000
  });
  socketApi.setupSocketIO(io);

  // ------------------------------------------------------------------ middleware
  app.use(sec.httpsRedirect);
  app.use(sec.securityHeaders());
  app.use(sec.permissionsPolicy);
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', sec.originGuard);
  app.use('/api', limiters.global);
  app.use(express.json({ limit: '3mb' }));

  // ------------------------------------------------------------------ auth helpers
  const auth = asyncHandler(async (req, res, next) => {
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) throw new HttpError(401, 'Autenticação necessária.');
    const payload = sec.verifyToken(header.slice(7));
    if (!payload) throw new HttpError(401, 'Sessão inválida ou expirada.');
    const user = await db.getAuthUser(payload.id);
    if (!user || (Number(user.token_version) || 0) !== payload.tv) throw new HttpError(401, 'Sessão inválida ou expirada.');
    req.user = { id: user.id, username: user.username };
    next();
  });

  const idParam = (req, name) => {
    const id = sec.toId(req.params[name]);
    if (!id) throw new HttpError(400, 'Identificador inválido.');
    return id;
  };
  const requireMember = async (serverId, userId) => {
    const role = await db.getMemberRole(serverId, userId);
    if (!role) throw new HttpError(403, 'Acesso negado.');
    return role;
  };
  const isStaff = (role) => role === 'owner' || role === 'admin';

  const withPresence = (u) => presence.apply(u);

  const makeRecoveryCodes = async (userId) => {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => sec.generateRecoveryCode());
    const hashes = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
    await db.replaceRecoveryCodes(userId, hashes);
    return codes;
  };

  // Falha de senha: contabiliza e bloqueia a conta temporariamente.
  const failAttempt = async (user) => {
    const r = await db.recordLoginFailure(user.id);
    if (r.locked) throw new HttpError(429, 'Muitas tentativas. Tente novamente em alguns minutos.');
  };
  const isLocked = (user) => user.locked_until && new Date(user.locked_until).getTime() > Date.now();

  const verifyPassword = async (user, password) => {
    if (typeof password !== 'string' || !password || password.length > 200) return false;
    if (isLocked(user)) throw new HttpError(429, 'Muitas tentativas. Tente novamente em alguns minutos.');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) await failAttempt(user);
    return ok;
  };

  // ------------------------------------------------------------------ meta / health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'online', uptime: Math.floor(process.uptime()) });
  });

  app.get('/api/meta', (req, res) => {
    res.json({
      privacyContact: cfg.PRIVACY_CONTACT,
      consentVersion: cfg.CONSENT_VERSION,
      limits: { maxMessageLength: cfg.LIMITS.MAX_MESSAGE_LENGTH, maxVoiceParticipants: socketApi.limits.MAX_VOICE_PARTICIPANTS }
    });
  });

  app.get('/api/ice-servers', auth, (req, res) => {
    const iceServers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
    if (cfg.TURN_URLS.length && cfg.TURN_USERNAME && cfg.TURN_CREDENTIAL) {
      iceServers.push({ urls: cfg.TURN_URLS, username: cfg.TURN_USERNAME, credential: cfg.TURN_CREDENTIAL });
    }
    res.json({ iceServers });
  });

  app.get('/api/keep-alive/status', auth, limiters.sensitive, (req, res) => {
    const s = getKeepAliveStatus();
    res.json({ active: s.active, lastPingTime: s.lastPingTime, lastPingStatus: s.lastPingStatus, intervalMinutes: s.intervalMinutes });
  });
  app.post('/api/keep-alive/trigger', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const result = await executePing();
    const s = getKeepAliveStatus();
    res.json({ result: result ? { success: !!result.success } : null, status: { active: s.active, lastPingTime: s.lastPingTime, lastPingStatus: s.lastPingStatus } });
  }));

  // ------------------------------------------------------------------ AUTH
  app.post('/api/auth/firebase', limiters.login, asyncHandler(async (req, res) => {
    const { token, acceptTerms } = bodyOf(req);
    if (!token) throw new HttpError(400, 'Token Firebase ausente.');

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (err) {
      throw new HttpError(401, 'Token Firebase inválido.');
    }

    const { uid, email, name, picture } = decoded;

    let user = await db.pool.query('SELECT * FROM users WHERE firebase_uid = $1', [uid]).then(r => r.rows[0]);
    
    // Fallback pra email caso já exista conta com esse email
    if (!user && email) {
      user = await db.pool.query('SELECT * FROM users WHERE email = $1', [email]).then(r => r.rows[0]);
      if (user) {
        await db.pool.query('UPDATE users SET firebase_uid = $1 WHERE id = $2', [uid, user.id]);
      }
    }

    if (!user) {
      if (acceptTerms !== true) {
        throw new HttpError(400, 'É necessário aceitar os Termos de Uso e a Política de Privacidade (LGPD).');
      }
      // Criar nova conta baseada no Firebase
      const baseName = (name || email?.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 15);
      let username = baseName || 'user';
      let count = 0;
      while (await db.getUserWithSecretsByUsername(username)) {
        count++;
        username = `${baseName}${count}`;
      }
      
      const pass = await bcrypt.hash(Math.random().toString(), 1); // senha dummy, ele usa Firebase agora
      
      user = await db.createUser({
        username,
        passwordHash: pass,
        displayName: name || username,
        consentVersion: cfg.CONSENT_VERSION
      });
      await db.pool.query('UPDATE users SET firebase_uid = $1, email = $2, avatar_url = $3 WHERE id = $4', [uid, email, picture, user.id]);
      user = await db.getUserById(user.id);
    } else if (acceptTerms === true && user.consent_version !== cfg.CONSENT_VERSION) {
      // Atualizar consentimento se mandou
      await db.pool.query('UPDATE users SET consent_version = $1, consent_at = CURRENT_TIMESTAMP WHERE id = $2', [cfg.CONSENT_VERSION, user.id]);
      user.consent_version = cfg.CONSENT_VERSION;
    }

    const full = await db.getAuthUser(user.id);
    res.status(user.created_at ? 200 : 201).json({
      user: withPresence(publicSelf(user)),
      token: sec.signToken(full),
      needsConsent: user.consent_version !== cfg.CONSENT_VERSION
    });
  }));
  app.post('/api/auth/register', limiters.register, asyncHandler(async (req, res) => {
    const b = bodyOf(req);
    const username = str(b.username) && b.username.trim();
    if (!username || !sec.USERNAME_RE.test(username)) {
      throw new HttpError(400, 'Nome de usuário: 3 a 20 caracteres (letras, números, _ ou .).');
    }
    if (RESERVED_USERNAMES.has(username.toLowerCase())) throw new HttpError(400, 'Este nome de usuário é reservado.');
    const pwError = sec.validatePassword(b.password, username);
    if (pwError) throw new HttpError(400, pwError);
    if (b.acceptTerms !== true) {
      throw new HttpError(400, 'É necessário aceitar os Termos de Uso e a Política de Privacidade.');
    }
    let displayName = username;
    if (b.displayName !== undefined) {
      const dn = sec.cleanText(b.displayName, 40);
      if (dn === null || dn.trim().length < 1 || dn.trim().length > 32) throw new HttpError(400, 'O nome de exibição deve ter de 1 a 32 caracteres.');
      displayName = dn.trim();
    }
    if (await db.getUserWithSecretsByUsername(username)) throw new HttpError(409, 'Nome de usuário indisponível.');

    const passwordHash = await bcrypt.hash(b.password, cfg.BCRYPT_COST);
    let user;
    try {
      user = await db.createUser({ username, passwordHash, displayName, consentVersion: cfg.CONSENT_VERSION });
    } catch (err) {
      if (db.isUniqueViolation(err)) throw new HttpError(409, 'Nome de usuário indisponível.');
      throw err;
    }
    const recoveryCodes = await makeRecoveryCodes(user.id);
    const full = await db.getAuthUser(user.id);
    res.status(201).json({ user: withPresence(publicSelf(user)), token: sec.signToken(full), recoveryCodes });
  }));

  app.post('/api/auth/login', limiters.login, asyncHandler(async (req, res) => {
    const b = bodyOf(req);
    const login = str(b.login);
    const password = str(b.password);
    if (!login || !password || login.length > 64 || password.length > 200) throw new HttpError(400, 'Informe usuário e senha.');
    const generic = new HttpError(401, 'Usuário ou senha incorretos.');

    const user = await db.getUserWithSecretsByUsername(login.trim());
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH); // equaliza o tempo de resposta
      throw generic;
    }
    if (isLocked(user)) throw new HttpError(429, 'Muitas tentativas. Tente novamente em alguns minutos.');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      await failAttempt(user);
      throw generic;
    }
    await db.resetLoginFailures(user.id);
    // Atualiza hashes antigos para o custo atual
    try {
      if (bcrypt.getRounds(user.password) < cfg.BCRYPT_COST) {
        await db.setPassword(user.id, await bcrypt.hash(password, cfg.BCRYPT_COST));
        user.token_version = (Number(user.token_version) || 0) + 1;
      }
    } catch { /* não crítico */ }
    const fresh = await db.getUserById(user.id);
    res.json({
      user: withPresence(publicSelf(fresh)),
      token: sec.signToken({ id: user.id, token_version: user.token_version }),
      needsConsent: fresh.consent_version !== cfg.CONSENT_VERSION
    });
  }));

  // Redefinição de senha SOMENTE com um código de recuperação de uso único.
  app.post('/api/auth/reset-password', limiters.reset, asyncHandler(async (req, res) => {
    const b = bodyOf(req);
    const login = str(b.login);
    const code = sec.normalizeRecoveryCode(b.recoveryCode);
    if (!login || login.length > 64 || !code) throw new HttpError(400, 'Informe o usuário e um código de recuperação válido (XXXX-XXXX-XXXX).');
    const generic = new HttpError(400, 'Usuário ou código de recuperação inválido.');

    const user = await db.getUserWithSecretsByUsername(login.trim());
    if (!user) {
      for (let i = 0; i < 3; i++) await bcrypt.compare(code, DUMMY_HASH);
      throw generic;
    }
    if (isLocked(user)) throw new HttpError(429, 'Muitas tentativas. Tente novamente em alguns minutos.');
    const pwError = sec.validatePassword(b.newPassword, user.username);
    if (pwError) throw new HttpError(400, pwError);

    const rows = await db.getUnusedRecoveryCodes(user.id);
    let matched = null;
    for (const r of rows) {
      // eslint-disable-next-line no-await-in-loop
      if (!matched && (await bcrypt.compare(code, r.code_hash))) matched = r;
    }
    if (!matched) {
      await failAttempt(user);
      throw generic;
    }
    await db.markRecoveryCodeUsed(matched.id);
    await db.setPassword(user.id, await bcrypt.hash(b.newPassword, cfg.BCRYPT_COST));
    socketApi.disconnectUser(user.id);
    res.json({ success: true, message: 'Senha redefinida. Faça login com a nova senha.', recoveryCodesLeft: rows.length - 1 });
  }));

  app.get('/api/auth/me', auth, asyncHandler(async (req, res) => {
    const user = await db.getUserById(req.user.id);
    if (!user) throw new HttpError(401, 'Sessão inválida.');
    res.json({
      user: withPresence(publicSelf(user)),
      needsConsent: user.consent_version !== cfg.CONSENT_VERSION,
      recoveryCodesLeft: await db.countUnusedRecoveryCodes(user.id)
    });
  }));

  app.put('/api/auth/password', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const b = bodyOf(req);
    const user = await db.getUserWithSecretsById(req.user.id);
    if (!(await verifyPassword(user, b.currentPassword))) throw new HttpError(400, 'Senha atual incorreta.');
    const pwError = sec.validatePassword(b.newPassword, user.username);
    if (pwError) throw new HttpError(400, pwError);
    if (b.newPassword === b.currentPassword) throw new HttpError(400, 'A nova senha deve ser diferente da atual.');
    const updated = await db.setPassword(user.id, await bcrypt.hash(b.newPassword, cfg.BCRYPT_COST));
    socketApi.disconnectUser(user.id); // derruba as sessões antigas; o cliente reconecta com o novo token
    res.json({ success: true, token: sec.signToken(updated) });
  }));

  app.post('/api/auth/recovery-codes', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const user = await db.getUserWithSecretsById(req.user.id);
    if (!(await verifyPassword(user, bodyOf(req).password))) throw new HttpError(400, 'Senha incorreta.');
    res.json({ recoveryCodes: await makeRecoveryCodes(user.id) });
  }));

  app.post('/api/auth/logout-all', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const updated = await db.bumpTokenVersion(req.user.id);
    socketApi.disconnectUser(req.user.id);
    res.json({ success: true, token: sec.signToken(updated) });
  }));

  app.post('/api/users/friend-code/regenerate', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    res.json({ friendCode: await db.regenerateFriendCode(req.user.id) });
  }));

  // ------------------------------------------------------------------ PERFIL
  app.put('/api/users/profile', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const checked = sec.sanitizeProfile(req.body);
    if (checked.error) throw new HttpError(400, checked.error);
    const updated = await db.updateUserProfile(req.user.id, checked.value);
    const shown = withPresence(publicSelf(updated));
    // mantém a identidade em memória dos sockets atualizada
    const sockets = await io.in(`user_${req.user.id}`).fetchSockets();
    sockets.forEach((s) => Object.assign(s.data.user, { display_name: updated.display_name, avatar_url: updated.avatar_url, status_mode: updated.status_mode }));
    socketApi.broadcastPresence(req.user.id);
    res.json({ user: shown });
  }));

  // ------------------------------------------------------------------ AMIGOS
  app.get('/api/friends', auth, asyncHandler(async (req, res) => {
    const friends = (await db.getFriends(req.user.id)).map((f) => ({ ...f, user: withPresence(f.user) }));
    res.json({ friends });
  }));

  app.post('/api/friends/request', auth, limiters.friendRequest, asyncHandler(async (req, res) => {
    const b = bodyOf(req);
    let target = null;
    const rawCode = str(b.friendCode) || (str(b.username) && b.username.includes('-') ? b.username : null);
    if (rawCode) {
      const code = sec.normalizeFriendCode(rawCode);
      if (!code) throw new HttpError(400, 'Código de amigo inválido. Formato: DVD-XXXX-XXXX.');
      target = await db.getUserByFriendCode(code);
    } else {
      const username = str(b.username) && b.username.trim().replace(/^@/, '');
      if (!username || !sec.USERNAME_RE.test(username)) throw new HttpError(400, 'Informe um nome de usuário válido ou um código de amigo.');
      target = await db.getUserByUsername(username);
    }
    if (!target) throw new HttpError(404, 'Usuário não encontrado.');
    if (target.id === req.user.id) throw new HttpError(400, 'Você não pode adicionar a si mesmo.');

    const existing = await db.findFriendship(req.user.id, target.id);
    if (existing) {
      if (existing.status === 'accepted') throw new HttpError(409, 'Vocês já são amigos.');
      if (existing.user_id === req.user.id) throw new HttpError(409, 'Pedido já enviado. Aguarde a resposta.');
      // O outro já tinha enviado um pedido: aceitar automaticamente
      const accepted = await db.acceptFriendRequest(req.user.id, existing.id);
      const me = await db.getPublicUser(req.user.id);
      socketApi.notifyUser(target.id, 'friend_request_accepted', { friendshipId: existing.id, by: publicLite(me) });
      return res.status(200).json({ request: { id: accepted.id, status: 'accepted' }, user: publicLite(target), autoAccepted: true });
    }
    if ((await db.countFriends(req.user.id)) >= cfg.LIMITS.MAX_FRIENDS) throw new HttpError(400, 'Limite de amigos atingido.');
    const request = await db.createFriendRequest(req.user.id, target.id);
    const me = await db.getPublicUser(req.user.id);
    socketApi.notifyUser(target.id, 'friend_request_received', { friendshipId: request.id, from: publicLite(me) });
    res.status(201).json({ request: { id: request.id, status: 'pending' }, user: publicLite(target) });
  }));

  app.put('/api/friends/:id/accept', auth, asyncHandler(async (req, res) => {
    const id = idParam(req, 'id');
    const updated = await db.acceptFriendRequest(req.user.id, id);
    if (!updated) throw new HttpError(404, 'Pedido não encontrado.');
    const me = await db.getPublicUser(req.user.id);
    socketApi.notifyUser(updated.user_id, 'friend_request_accepted', { friendshipId: updated.id, by: publicLite(me) });
    res.json({ success: true });
  }));

  app.delete('/api/friends/:id', auth, asyncHandler(async (req, res) => {
    const id = idParam(req, 'id');
    const f = await db.getFriendship(id);
    if (!f || (f.user_id !== req.user.id && f.friend_id !== req.user.id)) throw new HttpError(404, 'Amizade não encontrada.');
    await db.removeFriendship(id);
    const otherId = f.user_id === req.user.id ? f.friend_id : f.user_id;
    socketApi.notifyUser(otherId, 'friend_removed', { userId: req.user.id });
    res.json({ success: true });
  }));

  // ------------------------------------------------------------------ MENSAGENS DIRETAS
  const requireFriend = async (a, b) => {
    if (!(await db.areFriends(a, b))) throw new HttpError(403, 'Você só pode conversar com amigos.');
  };

  app.get('/api/dms/:userId', auth, asyncHandler(async (req, res) => {
    const other = idParam(req, 'userId');
    await requireFriend(req.user.id, other);
    res.json({ messages: await db.getDirectMessages(req.user.id, other) });
  }));

  app.post('/api/dms/:userId', auth, limiters.messages, asyncHandler(async (req, res) => {
    const other = idParam(req, 'userId');
    const b = bodyOf(req);
    const checked = sec.sanitizeMessagePayload(b.content, b.attachments);
    if (checked.error) throw new HttpError(400, checked.error);
    await requireFriend(req.user.id, other);
    const message = await db.createDirectMessage(req.user.id, other, checked.content, checked.attachments);
    socketApi.notifyUser(other, 'new_dm', message);
    socketApi.notifyUser(req.user.id, 'new_dm', message);
    res.status(201).json({ message });
  }));

  app.delete('/api/dms/messages/:id', auth, asyncHandler(async (req, res) => {
    const id = idParam(req, 'id');
    const m = await db.getDirectMessage(id);
    if (!m || m.sender_id !== req.user.id) throw new HttpError(404, 'Mensagem não encontrada.');
    await db.deleteDirectMessage(id);
    socketApi.notifyUser(m.receiver_id, 'dm_deleted', { messageId: id, userId: m.sender_id });
    socketApi.notifyUser(m.sender_id, 'dm_deleted', { messageId: id, userId: m.receiver_id });
    res.json({ success: true });
  }));

  // ------------------------------------------------------------------ SERVIDORES
  app.get('/api/servers', auth, asyncHandler(async (req, res) => {
    res.json({ servers: await db.getUserServers(req.user.id) });
  }));

  app.post('/api/servers', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const name = sec.cleanText(bodyOf(req).name, 60);
    if (name === null || name.trim().length < 2 || name.trim().length > 50) throw new HttpError(400, 'O nome do servidor deve ter de 2 a 50 caracteres.');
    if ((await db.countOwnedServers(req.user.id)) >= cfg.LIMITS.MAX_SERVERS_OWNED) throw new HttpError(400, 'Você atingiu o limite de servidores criados.');
    const server = await db.createServer({ name: name.trim(), ownerId: req.user.id });
    socketApi.addUserToServer(req.user.id, server.id);
    res.status(201).json({ server });
  }));

  const joinServer = async (server, userId) => {
    const role = await db.getMemberRole(server.id, userId);
    if (role) return { server: { ...server, role }, already: true };
    if ((await db.countServerMembers(server.id)) >= cfg.LIMITS.MAX_MEMBERS_PER_SERVER) throw new HttpError(403, 'Este servidor está cheio.');
    if ((await db.countJoinedServers(userId)) >= cfg.LIMITS.MAX_SERVERS_JOINED) throw new HttpError(400, 'Você atingiu o limite de servidores.');
    await db.addMember(server.id, userId, 'member');
    socketApi.addUserToServer(userId, server.id);
    const user = await db.getPublicUser(userId);
    socketApi.notifyServer(server.id, 'member_joined', { serverId: server.id, user: withPresence({ ...publicLite(user), status_mode: user.status_mode, role: 'member' }) });
    return { server: { ...server, role: 'member' }, already: false };
  };

  app.post('/api/servers/join', auth, limiters.inviteGuess, asyncHandler(async (req, res) => {
    const code = sec.normalizeInviteCode(bodyOf(req).inviteCode);
    if (!code) throw new HttpError(400, 'Código de convite inválido.');
    const server = await db.getServerByInvite(code);
    if (!server) throw new HttpError(404, 'Convite inválido ou expirado.');
    const { server: joined } = await joinServer(server, req.user.id);
    res.json({ server: joined });
  }));

  app.get('/api/servers/:serverId/channels', auth, asyncHandler(async (req, res) => {
    const serverId = idParam(req, 'serverId');
    await requireMember(serverId, req.user.id);
    const channels = await db.getServerChannels(serverId);
    res.json({
      channels: channels.map((ch) => ({ ...ch, occupants: ch.type === 'voice' ? socketApi.getVoiceOccupants(ch.id) : [] }))
    });
  }));

  app.post('/api/servers/:serverId/channels', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const serverId = idParam(req, 'serverId');
    const role = await requireMember(serverId, req.user.id);
    if (!isStaff(role)) throw new HttpError(403, 'Apenas administradores podem criar canais.');
    const b = bodyOf(req);
    const type = b.type === undefined ? 'text' : b.type;
    if (type !== 'text' && type !== 'voice') throw new HttpError(400, 'Tipo de canal inválido.');
    const rawName = sec.cleanText(b.name, 60);
    const name = rawName === null ? '' : rawName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 40);
    if (name.length < 1) throw new HttpError(400, 'Nome de canal inválido.');
    const topic = b.topic === undefined ? '' : sec.cleanText(b.topic, 200);
    if (topic === null) throw new HttpError(400, 'Tópico inválido.');
    if ((await db.countServerChannels(serverId)) >= cfg.LIMITS.MAX_CHANNELS_PER_SERVER) throw new HttpError(400, 'Limite de canais atingido.');
    const channel = await db.createChannel({ serverId, name, type, topic: topic.trim() });
    socketApi.notifyServer(serverId, 'channel_created', { serverId, channel });
    res.status(201).json({ channel });
  }));

  app.delete('/api/servers/:serverId/channels/:channelId', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const serverId = idParam(req, 'serverId');
    const channelId = idParam(req, 'channelId');
    const role = await requireMember(serverId, req.user.id);
    if (!isStaff(role)) throw new HttpError(403, 'Apenas administradores podem excluir canais.');
    const ch = await db.getChannel(channelId);
    if (!ch || ch.server_id !== serverId) throw new HttpError(404, 'Canal não encontrado.');
    await db.deleteChannel(channelId);
    socketApi.closeChannel(channelId);
    socketApi.notifyServer(serverId, 'channel_deleted', { serverId, channelId });
    res.json({ success: true });
  }));

  app.get('/api/servers/:serverId/members', auth, asyncHandler(async (req, res) => {
    const serverId = idParam(req, 'serverId');
    await requireMember(serverId, req.user.id);
    res.json({ members: (await db.getServerMembers(serverId)).map(withPresence) });
  }));

  app.put('/api/servers/:serverId', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const serverId = idParam(req, 'serverId');
    const role = await requireMember(serverId, req.user.id);
    if (!isStaff(role)) throw new HttpError(403, 'Apenas administradores podem editar o servidor.');
    const name = sec.cleanText(bodyOf(req).name, 60);
    if (name === null || name.trim().length < 2 || name.trim().length > 50) throw new HttpError(400, 'O nome do servidor deve ter de 2 a 50 caracteres.');
    await db.renameServer(serverId, name.trim());
    socketApi.notifyServer(serverId, 'server_updated', { serverId, name: name.trim() });
    res.json({ success: true, name: name.trim() });
  }));

  app.post('/api/servers/:serverId/invite/regenerate', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const serverId = idParam(req, 'serverId');
    const role = await requireMember(serverId, req.user.id);
    if (!isStaff(role)) throw new HttpError(403, 'Apenas administradores podem gerar um novo convite.');
    const inviteCode = await db.regenerateServerInvite(serverId);
    res.json({ invite_code: inviteCode });
  }));

  app.delete('/api/servers/:serverId', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const serverId = idParam(req, 'serverId');
    const role = await requireMember(serverId, req.user.id);
    if (role !== 'owner') throw new HttpError(403, 'Apenas o dono pode excluir o servidor.');
    const channelIds = (await db.getServerChannels(serverId)).map((c) => c.id);
    await socketApi.closeServer(serverId, channelIds, () => db.deleteServerCascade(serverId));
    res.json({ success: true });
  }));

  app.post('/api/servers/:serverId/leave', auth, asyncHandler(async (req, res) => {
    const serverId = idParam(req, 'serverId');
    const role = await requireMember(serverId, req.user.id);
    if (role === 'owner') throw new HttpError(400, 'O dono não pode sair. Exclua o servidor ou transfira a propriedade.');
    const channelIds = (await db.getServerChannels(serverId)).map((c) => c.id);
    await db.removeMember(serverId, req.user.id);
    await socketApi.removeUserFromServer(req.user.id, serverId, channelIds);
    socketApi.notifyServer(serverId, 'member_left', { serverId, userId: req.user.id });
    res.json({ success: true });
  }));

  app.delete('/api/servers/:serverId/members/:userId', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const serverId = idParam(req, 'serverId');
    const targetId = idParam(req, 'userId');
    const role = await requireMember(serverId, req.user.id);
    if (!isStaff(role)) throw new HttpError(403, 'Sem permissão para expulsar membros.');
    if (targetId === req.user.id) throw new HttpError(400, 'Use "Sair do servidor".');
    const targetRole = await db.getMemberRole(serverId, targetId);
    if (!targetRole) throw new HttpError(404, 'Membro não encontrado.');
    if (targetRole === 'owner' || (targetRole === 'admin' && role !== 'owner')) throw new HttpError(403, 'Sem permissão sobre este membro.');
    const channelIds = (await db.getServerChannels(serverId)).map((c) => c.id);
    await db.removeMember(serverId, targetId);
    await socketApi.removeUserFromServer(targetId, serverId, channelIds);
    socketApi.notifyUser(targetId, 'kicked_from_server', { serverId });
    socketApi.notifyServer(serverId, 'member_left', { serverId, userId: targetId });
    res.json({ success: true });
  }));

  app.put('/api/servers/:serverId/members/:userId/role', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const serverId = idParam(req, 'serverId');
    const targetId = idParam(req, 'userId');
    const role = await requireMember(serverId, req.user.id);
    if (role !== 'owner') throw new HttpError(403, 'Apenas o dono altera cargos.');
    const newRole = bodyOf(req).role;
    if (newRole !== 'admin' && newRole !== 'member') throw new HttpError(400, 'Cargo inválido.');
    const targetRole = await db.getMemberRole(serverId, targetId);
    if (!targetRole || targetRole === 'owner') throw new HttpError(404, 'Membro não encontrado.');
    await db.setMemberRole(serverId, targetId, newRole);
    socketApi.notifyServer(serverId, 'member_role_changed', { serverId, userId: targetId, role: newRole });
    res.json({ success: true });
  }));

  // Convites de servidor enviados a amigos
  app.post('/api/servers/:serverId/invite-friend', auth, limiters.friendRequest, asyncHandler(async (req, res) => {
    const serverId = idParam(req, 'serverId');
    await requireMember(serverId, req.user.id);
    const targetId = sec.toId(bodyOf(req).userId);
    if (!targetId) throw new HttpError(400, 'Amigo inválido.');
    await requireFriend(req.user.id, targetId);
    if (await db.getMemberRole(serverId, targetId)) throw new HttpError(409, 'Seu amigo já está neste servidor.');
    const invite = await db.createServerInvite(serverId, req.user.id, targetId);
    if (!invite) throw new HttpError(409, 'Convite já enviado.');
    const server = await db.getServer(serverId);
    const me = await db.getPublicUser(req.user.id);
    socketApi.notifyUser(targetId, 'server_invite_received', {
      id: invite.id, server_id: serverId, server_name: server.name, from_id: me.id, from_username: me.username, from_display_name: me.display_name
    });
    res.status(201).json({ success: true });
  }));

  app.get('/api/server-invites', auth, asyncHandler(async (req, res) => {
    res.json({ invites: await db.getPendingServerInvites(req.user.id) });
  }));

  app.post('/api/server-invites/:id/accept', auth, asyncHandler(async (req, res) => {
    const invite = await db.getServerInvite(idParam(req, 'id'));
    if (!invite || invite.to_user_id !== req.user.id) throw new HttpError(404, 'Convite não encontrado.');
    const server = await db.getServer(invite.server_id);
    await db.deleteServerInvite(invite.id);
    if (!server) throw new HttpError(404, 'Este servidor não existe mais.');
    const { server: joined } = await joinServer(server, req.user.id);
    res.json({ server: joined });
  }));

  app.post('/api/server-invites/:id/decline', auth, asyncHandler(async (req, res) => {
    const invite = await db.getServerInvite(idParam(req, 'id'));
    if (!invite || invite.to_user_id !== req.user.id) throw new HttpError(404, 'Convite não encontrado.');
    await db.deleteServerInvite(invite.id);
    res.json({ success: true });
  }));

  // ------------------------------------------------------------------ MENSAGENS DE CANAL
  app.get('/api/channels/:channelId/messages', auth, asyncHandler(async (req, res) => {
    const access = await db.getChannelAccess(idParam(req, 'channelId'), req.user.id);
    if (!access) throw new HttpError(403, 'Acesso negado.');
    res.json({ messages: await db.getChannelMessages(access.channel.id) });
  }));

  app.post('/api/channels/:channelId/messages', auth, limiters.messages, asyncHandler(async (req, res) => {
    const access = await db.getChannelAccess(idParam(req, 'channelId'), req.user.id);
    if (!access || access.channel.type !== 'text') throw new HttpError(403, 'Acesso negado.');
    const b = bodyOf(req);
    const checked = sec.sanitizeMessagePayload(b.content, b.attachments);
    if (checked.error) throw new HttpError(400, checked.error);
    const message = await db.createMessage({ channelId: access.channel.id, userId: req.user.id, content: checked.content, attachments: checked.attachments });
    io.to(`channel_${access.channel.id}`).emit('new_message', message);
    res.status(201).json({ message });
  }));

  app.delete('/api/messages/:id', auth, asyncHandler(async (req, res) => {
    const id = idParam(req, 'id');
    const m = await db.getMessage(id);
    if (!m) throw new HttpError(404, 'Mensagem não encontrada.');
    const access = await db.getChannelAccess(m.channel_id, req.user.id);
    if (!access) throw new HttpError(404, 'Mensagem não encontrada.');
    if (m.user_id !== req.user.id && !isStaff(access.role)) throw new HttpError(403, 'Sem permissão.');
    await db.deleteMessage(id);
    io.to(`channel_${m.channel_id}`).emit('message_deleted', { channelId: m.channel_id, messageId: id });
    res.json({ success: true });
  }));

  // ------------------------------------------------------------------ LGPD
  app.get('/api/privacy/export', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const data = await db.exportUserData(req.user.id);
    res.setHeader('Content-Disposition', `attachment; filename="dvd-meus-dados-${req.user.username}.json"`);
    res.json(data);
  }));

  app.post('/api/privacy/consent', auth, asyncHandler(async (req, res) => {
    if (bodyOf(req).accept !== true) throw new HttpError(400, 'É necessário aceitar para continuar.');
    await db.registerConsent(req.user.id, cfg.CONSENT_VERSION);
    res.json({ success: true });
  }));

  app.delete('/api/privacy/account', auth, limiters.sensitive, asyncHandler(async (req, res) => {
    const user = await db.getUserWithSecretsById(req.user.id);
    if (!(await verifyPassword(user, bodyOf(req).password))) throw new HttpError(400, 'Senha incorreta.');
    const friendIds = await db.getAcceptedFriendIds(user.id);
    const servers = await db.getUserServers(user.id);
    const channelsByServer = new Map();
    for (const s of servers) channelsByServer.set(s.id, (await db.getServerChannels(s.id)).map((c) => c.id));

    socketApi.disconnectUser(user.id);
    const affected = await db.deleteUserAccount(user.id);
    for (const s of servers) {
      if (affected.deletedServers.includes(s.id)) {
        await socketApi.closeServer(s.id, channelsByServer.get(s.id));
      } else {
        socketApi.notifyServer(s.id, 'member_left', { serverId: s.id, userId: user.id });
      }
    }
    affected.transferred.forEach((t) => socketApi.notifyServer(t.serverId, 'member_role_changed', { serverId: t.serverId, userId: t.newOwnerId, role: 'owner' }));
    friendIds.forEach((id) => socketApi.notifyUser(id, 'friend_removed', { userId: user.id }));
    res.json({ success: true, message: 'Sua conta e seus dados foram excluídos.' });
  }));

  // ------------------------------------------------------------------ 404 / erros da API
  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

  // ------------------------------------------------------------------ cliente (SPA)
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(
    express.static(clientDist, {
      dotfiles: 'ignore',
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'no-cache');
      }
    })
  );
  app.get('*', (req, res) => {
    // Somente rotas "de página" caem no SPA; arquivos inexistentes (.env, .map, etc.) dão 404.
    if (path.extname(req.path)) return res.status(404).type('text/plain').send('Not found');
    const indexPath = path.join(clientDist, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return res.status(200).type('text/plain').send('DvD API ativa. Rode "npm run build" para gerar o cliente.');
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexPath);
  });
  app.use((req, res) => res.status(404).type('text/plain').send('Not found'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Conteúdo grande demais.' });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error('Erro interno:', err && err.stack ? err.stack.split('\n')[0] : err);
    if (res.headersSent) return undefined;
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  });

  return { app, server, io };
}

module.exports = { createApp };
