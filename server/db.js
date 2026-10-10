// Camada de dados do DvD (PostgreSQL / Neon). Todas as consultas são parametrizadas.
// Em desenvolvimento/testes (sem DATABASE_URL) usa pg-mem, um Postgres em memória.
const { Pool } = require('pg');
const cfg = require('./config');
const sec = require('./security');

let pool = null;
let dbKind = 'none'; // 'postgres' | 'memory'

const USER_COLS =
  'id, username, display_name, avatar_url, banner_color, bio, status_mode, status_text, friend_code, consent_version, created_at';
const PUBLIC_USER_COLS = 'id, username, display_name, avatar_url, banner_color, bio, status_mode, status_text';

const q = (text, params) => pool.query(text, params);
const one = async (text, params) => (await q(text, params)).rows[0] || null;
const many = async (text, params) => (await q(text, params)).rows;
const count = async (text, params) => Number((await one(text, params)).n);
const placeholders = (arr, offset = 0) => arr.map((_, i) => `$${i + offset + 1}`).join(', ');
const isUniqueViolation = (err) => err && (err.code === '23505' || /duplicate key|unique constraint/i.test(err.message || ''));

const parseAtt = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return []; }
  }
  return [];
};
const fixMsg = (row) => (row ? { ...row, attachments: parseAtt(row.attachments) } : row);

// ---------------------------------------------------------------------------
// Inicialização, esquema e migrações
// ---------------------------------------------------------------------------
async function initDB() {
  const url = process.env.DATABASE_URL;
  const wantsMemory = process.env.DVD_DB_MODE === 'memory' || (!url && !cfg.IS_PROD);

  if (url && /^postgres(ql)?:\/\//.test(url) && !wantsMemory) {
    console.log(' Conectando ao banco Neon PostgreSQL...');
    pool = new Pool({
      connectionString: url,
      // Se a URL já traz sslmode, ela define o comportamento; caso contrário exige TLS validado.
      ssl: /sslmode=/.test(url) ? undefined : { rejectUnauthorized: true },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
    await pool.query('SELECT 1');
    dbKind = 'postgres';
    console.log(' Conectado com sucesso ao Neon PostgreSQL!');
  } else if (wantsMemory) {
    // eslint-disable-next-line global-require
    const { newDb } = require('pg-mem');
    const mem = newDb();
    const { Pool: MemPool } = mem.adapters.createPg();
    pool = new MemPool();
    dbKind = 'memory';
    console.log(' Banco em memória (pg-mem) ativo: use apenas para desenvolvimento e testes.');
  } else {
    throw new Error('DATABASE_URL não configurada. Defina a URL do Neon PostgreSQL nas variáveis de ambiente.');
  }

  await createTables();
  await runMigrations();
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(120),
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    banner_color VARCHAR(30) DEFAULT '#5865F2',
    bio TEXT DEFAULT '',
    status_mode VARCHAR(20) DEFAULT 'online',
    status_text VARCHAR(100) DEFAULT '',
    friend_code VARCHAR(20),
    token_version INT DEFAULT 0,
    failed_logins INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    consent_at TIMESTAMPTZ,
    consent_version VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon_url TEXT,
    owner_id INT REFERENCES users(id) ON DELETE SET NULL,
    invite_code VARCHAR(30) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS server_members (
    server_id INT REFERENCES servers(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (server_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    server_id INT REFERENCES servers(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    type VARCHAR(20) DEFAULT 'text',
    topic VARCHAR(250) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    channel_id INT REFERENCES channels(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS friends (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    friend_id INT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id)
  )`,
  `CREATE TABLE IF NOT EXISTS direct_messages (
    id SERIAL PRIMARY KEY,
    sender_id INT REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS recovery_codes (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(100) NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS server_invites (
    id SERIAL PRIMARY KEY,
    server_id INT REFERENCES servers(id) ON DELETE CASCADE,
    from_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(server_id, to_user_id)
  )`
];

async function createTables() {
  for (const stmt of SCHEMA) await q(stmt);
  console.log(' Tabelas verificadas/criadas.');
}

async function tryRun(label, text, params) {
  try {
    await q(text, params);
  } catch (err) {
    if (dbKind === 'postgres') console.warn(` Migração "${label}" ignorada:`, err.message);
  }
}

// Migrações idempotentes para bancos criados por versões anteriores do DvD.
async function runMigrations() {
  const addCol = (table, col, def) => tryRun(`${table}.${col}`, `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def}`);
  await addCol('users', 'friend_code', 'VARCHAR(20)');
  await addCol('users', 'token_version', 'INT DEFAULT 0');
  await addCol('users', 'failed_logins', 'INT DEFAULT 0');
  await addCol('users', 'locked_until', 'TIMESTAMPTZ');
  await addCol('users', 'consent_at', 'TIMESTAMPTZ');
  await addCol('users', 'consent_version', 'VARCHAR(20)');
  await tryRun('users.email nullable', 'ALTER TABLE users ALTER COLUMN email DROP NOT NULL');
  await tryRun('idx friend_code', 'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_friend_code ON users (friend_code)');
  await tryRun('idx messages', 'CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages (channel_id, id)');
  await tryRun('idx dm', 'CREATE INDEX IF NOT EXISTS idx_dm_pair ON direct_messages (sender_id, receiver_id)');
  await tryRun('idx members', 'CREATE INDEX IF NOT EXISTS idx_members_user ON server_members (user_id)');

  // 1) Servidor público padrão (convite AMIGOS10) deixa de existir: ninguém entra mais sem convite.
  const legacy = await many("SELECT id FROM servers WHERE invite_code = 'AMIGOS10' AND owner_id IS NULL");
  for (const s of legacy) await deleteServerCascade(s.id);
  if (legacy.length) console.log(' Servidor público padrão removido (migração de segurança).');

  // 2) Convites antigos fracos (INV-xxxxxx) são substituídos por códigos aleatórios fortes.
  const weak = await many("SELECT id FROM servers WHERE invite_code LIKE 'INV-%'");
  for (const s of weak) await q('UPDATE servers SET invite_code = $1 WHERE id = $2', [sec.generateInviteCode(), s.id]);

  // 3) Minimização de dados (LGPD): e-mail deixa de ser coletado/armazenado.
  await tryRun('purge email', 'UPDATE users SET email = NULL WHERE email IS NOT NULL');

  // 4) Privacidade: sem URLs externas de avatar/ícone (ex.: serviços de terceiros).
  await tryRun('purge avatars', "UPDATE users SET avatar_url = NULL WHERE avatar_url IS NOT NULL AND avatar_url NOT LIKE 'data:image/%'");
  await tryRun('purge icons', "UPDATE servers SET icon_url = NULL WHERE icon_url IS NOT NULL AND icon_url NOT LIKE 'data:image/%'");

  // 5) Código de amigo para usuários existentes.
  const noCode = await many('SELECT id FROM users WHERE friend_code IS NULL');
  for (const u of noCode) await assignFriendCode(u.id);
}

async function assignFriendCode(userId) {
  for (let i = 0; i < 8; i++) {
    const code = sec.generateFriendCode();
    try {
      const row = await one('UPDATE users SET friend_code = $1 WHERE id = $2 RETURNING friend_code', [code, userId]);
      return row && row.friend_code;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error('Não foi possível gerar código de amigo.');
}

async function close() {
  if (pool) await pool.end().catch(() => {});
  pool = null;
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------
const getUserWithSecretsByUsername = (username) =>
  one('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
const getUserWithSecretsById = (id) => one('SELECT * FROM users WHERE id = $1', [id]);
const getUserById = (id) => one(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [id]);
const getPublicUser = (id) => one(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE id = $1`, [id]);
const getAuthUser = (id) => one('SELECT id, username, token_version FROM users WHERE id = $1', [id]);
const getUserByFriendCode = (code) => one(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE friend_code = $1`, [code]);
const getUserByUsername = (username) =>
  one(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE LOWER(username) = LOWER($1)`, [username]);

async function createUser({ username, passwordHash, displayName, consentVersion }) {
  const user = await one(
    `INSERT INTO users (username, password, display_name, avatar_url, consent_at, consent_version)
     VALUES ($1, $2, $3, NULL, $4, $5) RETURNING id`,
    [username, passwordHash, displayName || username, new Date(), consentVersion]
  );
  await assignFriendCode(user.id);
  return getUserById(user.id);
}

async function updateUserProfile(id, p) {
  const sets = [];
  const vals = [];
  const map = {
    displayName: 'display_name',
    avatarUrl: 'avatar_url',
    bannerColor: 'banner_color',
    bio: 'bio',
    statusMode: 'status_mode',
    statusText: 'status_text'
  };
  for (const [key, col] of Object.entries(map)) {
    if (Object.prototype.hasOwnProperty.call(p, key)) {
      vals.push(p[key]);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if (!sets.length) return getUserById(id);
  vals.push(id);
  await q(`UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
  return getUserById(id);
}

const registerConsent = (id, version) =>
  q('UPDATE users SET consent_at = $1, consent_version = $2 WHERE id = $3', [new Date(), version, id]);

// Troca de senha: incrementa token_version, invalidando todas as sessões antigas.
async function setPassword(id, passwordHash) {
  await q(
    'UPDATE users SET password = $1, token_version = COALESCE(token_version, 0) + 1, failed_logins = 0, locked_until = NULL WHERE id = $2',
    [passwordHash, id]
  );
  return getAuthUser(id);
}
async function bumpTokenVersion(id) {
  await q('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1', [id]);
  return getAuthUser(id);
}

async function recordLoginFailure(id) {
  const u = await one('SELECT failed_logins FROM users WHERE id = $1', [id]);
  const fails = (u && Number(u.failed_logins) || 0) + 1;
  let lockedUntil = null;
  let newFails = fails;
  if (fails >= cfg.LOCKOUT.MAX_FAILS) {
    lockedUntil = new Date(Date.now() + cfg.LOCKOUT.MINUTES * 60 * 1000);
    newFails = 0;
  }
  await q('UPDATE users SET failed_logins = $1, locked_until = $2 WHERE id = $3', [newFails, lockedUntil, id]);
  return { locked: !!lockedUntil, lockedUntil };
}
const resetLoginFailures = (id) => q('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [id]);

const regenerateFriendCode = (id) => assignFriendCode(id);

// Códigos de recuperação (armazenados apenas como hash bcrypt)
async function replaceRecoveryCodes(userId, hashes) {
  await q('DELETE FROM recovery_codes WHERE user_id = $1', [userId]);
  for (const h of hashes) await q('INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)', [userId, h]);
}
const getUnusedRecoveryCodes = (userId) =>
  many('SELECT id, code_hash FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL', [userId]);
const markRecoveryCodeUsed = (id) => q('UPDATE recovery_codes SET used_at = $1 WHERE id = $2', [new Date(), id]);
const countUnusedRecoveryCodes = (userId) =>
  count('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL', [userId]);

// ---------------------------------------------------------------------------
// Servidores, membros e canais
// ---------------------------------------------------------------------------
const getUserServers = (userId) =>
  many(
    `SELECT s.id, s.name, s.icon_url, s.owner_id, s.invite_code, s.created_at, sm.role
     FROM servers s JOIN server_members sm ON sm.server_id = s.id
     WHERE sm.user_id = $1 ORDER BY s.id ASC`,
    [userId]
  );
const getServer = (id) => one('SELECT * FROM servers WHERE id = $1', [id]);
const getMemberRole = async (serverId, userId) => {
  const r = await one('SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2', [serverId, userId]);
  return r ? r.role : null;
};
const countOwnedServers = (userId) => count('SELECT COUNT(*) AS n FROM servers WHERE owner_id = $1', [userId]);
const countJoinedServers = (userId) => count('SELECT COUNT(*) AS n FROM server_members WHERE user_id = $1', [userId]);
const countServerMembers = (serverId) => count('SELECT COUNT(*) AS n FROM server_members WHERE server_id = $1', [serverId]);
const countServerChannels = (serverId) => count('SELECT COUNT(*) AS n FROM channels WHERE server_id = $1', [serverId]);

async function createServer({ name, ownerId }) {
  let server = null;
  for (let i = 0; i < 8 && !server; i++) {
    try {
      server = await one(
        'INSERT INTO servers (name, icon_url, owner_id, invite_code) VALUES ($1, NULL, $2, $3) RETURNING *',
        [name, ownerId, sec.generateInviteCode()]
      );
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  if (!server) throw new Error('Falha ao gerar convite.');
  await q('INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, $3)', [server.id, ownerId, 'owner']);
  await q('INSERT INTO channels (server_id, name, type, topic) VALUES ($1, $2, $3, $4)', [server.id, 'geral', 'text', 'Canal de texto principal']);
  await q('INSERT INTO channels (server_id, name, type, topic) VALUES ($1, $2, $3, $4)', [server.id, 'Sala de Voz', 'voice', 'Canal de voz principal']);
  return { ...server, role: 'owner' };
}

const getServerByInvite = (code) => one('SELECT * FROM servers WHERE UPPER(invite_code) = $1', [code]);
async function addMember(serverId, userId, role = 'member') {
  try {
    await q('INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, $3)', [serverId, userId, role]);
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}
const removeMember = (serverId, userId) =>
  q('DELETE FROM server_members WHERE server_id = $1 AND user_id = $2', [serverId, userId]);
const setMemberRole = (serverId, userId, role) =>
  q('UPDATE server_members SET role = $1 WHERE server_id = $2 AND user_id = $3', [role, serverId, userId]);
async function regenerateServerInvite(serverId) {
  for (let i = 0; i < 8; i++) {
    try {
      const row = await one('UPDATE servers SET invite_code = $1 WHERE id = $2 RETURNING invite_code', [sec.generateInviteCode(), serverId]);
      return row && row.invite_code;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error('Falha ao gerar convite.');
}
const renameServer = (serverId, name) => q('UPDATE servers SET name = $1 WHERE id = $2', [name, serverId]);

const getServerChannels = (serverId) =>
  many('SELECT id, server_id, name, type, topic, created_at FROM channels WHERE server_id = $1 ORDER BY type ASC, id ASC', [serverId]);
const getChannel = (id) => one('SELECT id, server_id, name, type, topic FROM channels WHERE id = $1', [id]);
const createChannel = ({ serverId, name, type, topic }) =>
  one('INSERT INTO channels (server_id, name, type, topic) VALUES ($1, $2, $3, $4) RETURNING id, server_id, name, type, topic, created_at', [
    serverId, name, type, topic || ''
  ]);
async function deleteChannel(id) {
  await q('DELETE FROM messages WHERE channel_id = $1', [id]);
  await q('DELETE FROM channels WHERE id = $1', [id]);
}
const getServerMembers = (serverId) =>
  many(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, u.status_mode, u.status_text, sm.role
     FROM server_members sm JOIN users u ON u.id = sm.user_id
     WHERE sm.server_id = $1 ORDER BY u.display_name ASC`,
    [serverId]
  );
const getServerMemberIds = async (serverId) => (await many('SELECT user_id FROM server_members WHERE server_id = $1', [serverId])).map((r) => r.user_id);

// Resolve em uma consulta: o canal e o papel do usuário no servidor dele (null = não é membro).
async function getChannelAccess(channelId, userId) {
  const ch = await getChannel(channelId);
  if (!ch) return null;
  const role = await getMemberRole(ch.server_id, userId);
  return role ? { channel: ch, role } : null;
}

async function deleteServerCascade(serverId) {
  const chans = await many('SELECT id FROM channels WHERE server_id = $1', [serverId]);
  for (const c of chans) await q('DELETE FROM messages WHERE channel_id = $1', [c.id]);
  await q('DELETE FROM channels WHERE server_id = $1', [serverId]);
  await q('DELETE FROM server_invites WHERE server_id = $1', [serverId]);
  await q('DELETE FROM server_members WHERE server_id = $1', [serverId]);
  await q('DELETE FROM servers WHERE id = $1', [serverId]);
  return chans.map((c) => c.id);
}

async function transferOwnership(serverId, newOwnerId) {
  await q('UPDATE servers SET owner_id = $1 WHERE id = $2', [newOwnerId, serverId]);
  await setMemberRole(serverId, newOwnerId, 'owner');
}

// Convites de servidor enviados a amigos
async function createServerInvite(serverId, fromId, toId) {
  try {
    return await one('INSERT INTO server_invites (server_id, from_user_id, to_user_id) VALUES ($1, $2, $3) RETURNING *', [serverId, fromId, toId]);
  } catch (err) {
    if (isUniqueViolation(err)) return null;
    throw err;
  }
}
const getServerInvite = (id) => one('SELECT * FROM server_invites WHERE id = $1', [id]);
const deleteServerInvite = (id) => q('DELETE FROM server_invites WHERE id = $1', [id]);
const getPendingServerInvites = (userId) =>
  many(
    `SELECT si.id, si.server_id, si.created_at, s.name AS server_name, s.icon_url AS server_icon,
            u.id AS from_id, u.username AS from_username, u.display_name AS from_display_name
     FROM server_invites si
     JOIN servers s ON s.id = si.server_id
     JOIN users u ON u.id = si.from_user_id
     WHERE si.to_user_id = $1 ORDER BY si.id DESC`,
    [userId]
  );

// ---------------------------------------------------------------------------
// Mensagens de canal
// ---------------------------------------------------------------------------
async function getChannelMessages(channelId, limit = 60) {
  const rows = await many(
    `SELECT m.id, m.channel_id, m.user_id, m.content, m.attachments, m.created_at,
            u.username, u.display_name, u.avatar_url, u.banner_color
     FROM messages m JOIN users u ON u.id = m.user_id
     WHERE m.channel_id = $1 ORDER BY m.id DESC LIMIT $2`,
    [channelId, limit]
  );
  return rows.reverse().map(fixMsg);
}
async function createMessage({ channelId, userId, content, attachments }) {
  const msg = await one(
    'INSERT INTO messages (channel_id, user_id, content, attachments) VALUES ($1, $2, $3, $4) RETURNING id, channel_id, user_id, content, attachments, created_at',
    [channelId, userId, content, JSON.stringify(attachments || [])]
  );
  const u = await one('SELECT username, display_name, avatar_url, banner_color FROM users WHERE id = $1', [userId]);
  return fixMsg({ ...msg, ...(u || {}) });
}
const getMessage = (id) => one('SELECT id, channel_id, user_id FROM messages WHERE id = $1', [id]);
const deleteMessage = (id) => q('DELETE FROM messages WHERE id = $1', [id]);

// ---------------------------------------------------------------------------
// Amizades e mensagens diretas
// ---------------------------------------------------------------------------
const findFriendship = (a, b) =>
  one('SELECT * FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)', [a, b]);
async function areFriends(a, b) {
  const f = await findFriendship(a, b);
  return !!f && f.status === 'accepted';
}
const createFriendRequest = (from, to) =>
  one("INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'pending') RETURNING *", [from, to]);
const countFriends = (userId) =>
  count("SELECT COUNT(*) AS n FROM friends WHERE status = 'accepted' AND (user_id = $1 OR friend_id = $1)", [userId]);

async function getFriends(userId) {
  const rels = await many('SELECT * FROM friends WHERE user_id = $1 OR friend_id = $1 ORDER BY id DESC', [userId]);
  if (!rels.length) return [];
  const otherIds = [...new Set(rels.map((r) => (r.user_id === userId ? r.friend_id : r.user_id)))];
  const users = await many(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE id IN (${placeholders(otherIds)})`, otherIds);
  const byId = new Map(users.map((u) => [u.id, u]));
  return rels
    .map((r) => {
      const otherId = r.user_id === userId ? r.friend_id : r.user_id;
      const u = byId.get(otherId);
      if (!u) return null;
      return {
        friendshipId: r.id,
        status: r.status,
        isIncoming: r.status === 'pending' && r.friend_id === userId,
        isOutgoing: r.status === 'pending' && r.user_id === userId,
        user: {
          id: u.id,
          username: u.username,
          display_name: u.display_name,
          avatar_url: u.avatar_url,
          status_mode: u.status_mode,
          status_text: u.status_text
        }
      };
    })
    .filter(Boolean);
}
const getAcceptedFriendIds = async (userId) => {
  const rows = await many("SELECT user_id, friend_id FROM friends WHERE status = 'accepted' AND (user_id = $1 OR friend_id = $1)", [userId]);
  return rows.map((r) => (r.user_id === userId ? r.friend_id : r.user_id));
};
const acceptFriendRequest = (userId, friendshipId) =>
  one("UPDATE friends SET status = 'accepted' WHERE id = $1 AND friend_id = $2 AND status = 'pending' RETURNING *", [friendshipId, userId]);
const getFriendship = (id) => one('SELECT * FROM friends WHERE id = $1', [id]);
const removeFriendship = (id) => q('DELETE FROM friends WHERE id = $1', [id]);

async function getDirectMessages(a, b, limit = 80) {
  const rows = await many(
    `SELECT dm.id, dm.sender_id, dm.receiver_id, dm.content, dm.attachments, dm.created_at,
            u.username, u.display_name, u.avatar_url
     FROM direct_messages dm JOIN users u ON u.id = dm.sender_id
     WHERE (dm.sender_id = $1 AND dm.receiver_id = $2) OR (dm.sender_id = $2 AND dm.receiver_id = $1)
     ORDER BY dm.id DESC LIMIT $3`,
    [a, b, limit]
  );
  return rows.reverse().map(fixMsg);
}
async function createDirectMessage(senderId, receiverId, content, attachments) {
  const dm = await one(
    'INSERT INTO direct_messages (sender_id, receiver_id, content, attachments) VALUES ($1, $2, $3, $4) RETURNING id, sender_id, receiver_id, content, attachments, created_at',
    [senderId, receiverId, content, JSON.stringify(attachments || [])]
  );
  const u = await one('SELECT username, display_name, avatar_url FROM users WHERE id = $1', [senderId]);
  return fixMsg({ ...dm, ...(u || {}) });
}
const getDirectMessage = (id) => one('SELECT id, sender_id, receiver_id FROM direct_messages WHERE id = $1', [id]);
const deleteDirectMessage = (id) => q('DELETE FROM direct_messages WHERE id = $1', [id]);

// ---------------------------------------------------------------------------
// LGPD: exportação e exclusão de dados do titular
// ---------------------------------------------------------------------------
async function exportUserData(userId) {
  const profile = await getUserById(userId);
  const servers = await getUserServers(userId);
  const messages = (
    await many('SELECT id, channel_id, content, attachments, created_at FROM messages WHERE user_id = $1 ORDER BY id ASC', [userId])
  ).map(fixMsg);
  const dms = (
    await many(
      'SELECT id, sender_id, receiver_id, content, attachments, created_at FROM direct_messages WHERE sender_id = $1 OR receiver_id = $1 ORDER BY id ASC',
      [userId]
    )
  ).map(fixMsg);
  const friends = await getFriends(userId);
  const recovery = await countUnusedRecoveryCodes(userId);
  return {
    exportedAt: new Date().toISOString(),
    notice:
      'Exportação dos seus dados pessoais no DvD (LGPD, art. 18). A senha é armazenada apenas como hash irreversível e não é incluída.',
    profile,
    servers: servers.map((s) => ({ id: s.id, name: s.name, role: s.role, createdAt: s.created_at })),
    friends: friends.map((f) => ({ status: f.status, username: f.user.username, displayName: f.user.display_name })),
    messagesInServers: messages,
    directMessages: dms,
    recoveryCodesUnused: recovery
  };
}

// Exclui TODOS os dados do usuário. Servidores que ele possui são transferidos ao membro
// mais antigo; se não houver outros membros, o servidor é apagado.
async function deleteUserAccount(userId) {
  const affected = { deletedServers: [], transferred: [], deletedChannelIds: [] };
  const owned = await many('SELECT id FROM servers WHERE owner_id = $1', [userId]);
  for (const s of owned) {
    const others = await many(
      'SELECT user_id FROM server_members WHERE server_id = $1 AND user_id <> $2 ORDER BY joined_at ASC, user_id ASC LIMIT 1',
      [s.id, userId]
    );
    if (others.length) {
      await transferOwnership(s.id, others[0].user_id);
      affected.transferred.push({ serverId: s.id, newOwnerId: others[0].user_id });
    } else {
      const chanIds = await deleteServerCascade(s.id);
      affected.deletedServers.push(s.id);
      affected.deletedChannelIds.push(...chanIds);
    }
  }
  await q('DELETE FROM messages WHERE user_id = $1', [userId]);
  await q('DELETE FROM direct_messages WHERE sender_id = $1 OR receiver_id = $1', [userId]);
  await q('DELETE FROM friends WHERE user_id = $1 OR friend_id = $1', [userId]);
  await q('DELETE FROM server_invites WHERE from_user_id = $1 OR to_user_id = $1', [userId]);
  await q('DELETE FROM server_members WHERE user_id = $1', [userId]);
  await q('DELETE FROM recovery_codes WHERE user_id = $1', [userId]);
  await q('UPDATE servers SET owner_id = NULL WHERE owner_id = $1', [userId]);
  await q('DELETE FROM users WHERE id = $1', [userId]);
  return affected;
}

const getDatabaseStatus = () => ({ kind: dbKind, isPostgres: dbKind === 'postgres' });
const ping = () => q('SELECT 1');

module.exports = {
  initDB,
  close,
  ping,
  getDatabaseStatus,
  isUniqueViolation,
  // usuários
  getUserWithSecretsByUsername,
  getUserWithSecretsById,
  getUserById,
  getPublicUser,
  getAuthUser,
  getUserByFriendCode,
  getUserByUsername,
  createUser,
  updateUserProfile,
  registerConsent,
  setPassword,
  bumpTokenVersion,
  recordLoginFailure,
  resetLoginFailures,
  regenerateFriendCode,
  replaceRecoveryCodes,
  getUnusedRecoveryCodes,
  markRecoveryCodeUsed,
  countUnusedRecoveryCodes,
  // servidores
  getUserServers,
  getServer,
  getMemberRole,
  countOwnedServers,
  countJoinedServers,
  countServerMembers,
  countServerChannels,
  createServer,
  getServerByInvite,
  addMember,
  removeMember,
  setMemberRole,
  regenerateServerInvite,
  renameServer,
  getServerChannels,
  getChannel,
  createChannel,
  deleteChannel,
  getServerMembers,
  getServerMemberIds,
  getChannelAccess,
  deleteServerCascade,
  transferOwnership,
  createServerInvite,
  getServerInvite,
  deleteServerInvite,
  getPendingServerInvites,
  // mensagens
  getChannelMessages,
  createMessage,
  getMessage,
  deleteMessage,
  // amizades / DMs
  findFriendship,
  areFriends,
  createFriendRequest,
  countFriends,
  getFriends,
  getAcceptedFriendIds,
  acceptFriendRequest,
  getFriendship,
  removeFriendship,
  getDirectMessages,
  createDirectMessage,
  getDirectMessage,
  deleteDirectMessage,
  // LGPD
  exportUserData,
  deleteUserAccount
};
