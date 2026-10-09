const { Pool } = require('pg');

let pool = null;
let isPostgres = false;

// Fallback in-memory storage if Neon Postgres is not connected yet
const memoryStore = {
  users: [],
  servers: [],
  server_members: [],
  channels: [],
  messages: [],
  nextIds: { user: 1, server: 1, channel: 1, message: 1 }
};

async function initDB() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    try {
      console.log(' Conectando ao banco Neon PostgreSQL...');
      pool = new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test connection
      await pool.query('SELECT 1');
      isPostgres = true;
      console.log(' Conectado com sucesso ao Neon PostgreSQL!');

      // Create tables automatically
      await createTables();
      await seedDefaultServer();
      return;
    } catch (err) {
      console.warn(' Falha ao conectar no Neon Postgres:', err.message);
      console.warn(' Utilizando armazenamento local em memria como fallback.');
      pool = null;
      isPostgres = false;
    }
  } else {
    console.log(' Nenhuma DATABASE_URL informada. Rodando com armazenamento local para testes.');
  }

  // Seed default server in memory store
  seedDefaultMemory();
}

async function createTables() {
  const queries = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(120) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      display_name VARCHAR(100),
      avatar_url TEXT,
      banner_color VARCHAR(30) DEFAULT '#5865F2',
      bio TEXT DEFAULT '',
      status_mode VARCHAR(20) DEFAULT 'online',
      status_text VARCHAR(100) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS servers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      icon_url TEXT,
      owner_id INT REFERENCES users(id) ON DELETE SET NULL,
      invite_code VARCHAR(30) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS server_members (
      server_id INT REFERENCES servers(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) DEFAULT 'member',
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (server_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS channels (
      id SERIAL PRIMARY KEY,
      server_id INT REFERENCES servers(id) ON DELETE CASCADE,
      name VARCHAR(50) NOT NULL,
      type VARCHAR(20) DEFAULT 'text',
      topic VARCHAR(250) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      channel_id INT REFERENCES channels(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      attachments JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(queries);
  console.log(' Tabelas verificadas/criadas no Neon PostgreSQL.');
}

async function seedDefaultServer() {
  const res = await pool.query('SELECT COUNT(*) FROM servers');
  if (parseInt(res.rows[0].count) === 0) {
    const srv = await pool.query(
      `INSERT INTO servers (name, icon_url, invite_code) 
       VALUES ($1, $2, $3) RETURNING id`,
      ['Lobby dos Amigos', 'https://api.dicebear.com/7.x/identicon/svg?seed=LobbyAmigos', 'AMIGOS10']
    );
    const serverId = srv.rows[0].id;

    // Default channels
    const channels = [
      { name: 'geral', type: 'text', topic: 'Conversas gerais e memes dos 10 amigos' },
      { name: 'clipes-e-jogos', type: 'text', topic: 'Compartilhe seus clipes e melhores jogadas' },
      { name: 'musica-e-bots', type: 'text', topic: 'Chat de links e comandos' },
      { name: 'Sala de Jogos', type: 'voice', topic: 'Canal de voz para jogos' },
      { name: 'Bate-Papo', type: 'voice', topic: 'Canal de voz geral' },
      { name: 'Transmissão Ao Vivo', type: 'voice', topic: 'Para compartilhar telas e câmeras' }
    ];

    for (const ch of channels) {
      await pool.query(
        'INSERT INTO channels (server_id, name, type, topic) VALUES ($1, $2, $3, $4)',
        [serverId, ch.name, ch.type, ch.topic]
      );
    }
    console.log(' Servidor padro criado no Neon PostgreSQL com cdigo de convite: AMIGOS10');
  }
}

function seedDefaultMemory() {
  if (memoryStore.servers.length === 0) {
    const serverId = memoryStore.nextIds.server++;
    memoryStore.servers.push({
      id: serverId,
      name: 'Lobby dos Amigos',
      icon_url: 'https://api.dicebear.com/7.x/identicon/svg?seed=LobbyAmigos',
      owner_id: 1,
      invite_code: 'AMIGOS10',
      created_at: new Date()
    });

    const channels = [
      { name: 'geral', type: 'text', topic: 'Conversas gerais e memes dos 10 amigos' },
      { name: 'clipes-e-jogos', type: 'text', topic: 'Compartilhe seus clipes e melhores jogadas' },
      { name: 'musica-e-bots', type: 'text', topic: 'Chat de links e comandos' },
      { name: 'Sala de Jogos', type: 'voice', topic: 'Canal de voz para jogos' },
      { name: 'Bate-Papo', type: 'voice', topic: 'Canal de voz geral' },
      { name: 'Transmissão Ao Vivo', type: 'voice', topic: 'Para compartilhar telas e câmeras' }
    ];

    channels.forEach(ch => {
      memoryStore.channels.push({
        id: memoryStore.nextIds.channel++,
        server_id: serverId,
        name: ch.name,
        type: ch.type,
        topic: ch.topic,
        created_at: new Date()
      });
    });
  }
}

// User operations
async function getUserByEmailOrUsername(identifier) {
  if (isPostgres) {
    const res = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)',
      [identifier]
    );
    return res.rows[0] || null;
  } else {
    const lower = identifier.toLowerCase();
    return memoryStore.users.find(u => u.email.toLowerCase() === lower || u.username.toLowerCase() === lower) || null;
  }
}

async function getUserById(id) {
  if (isPostgres) {
    const res = await pool.query('SELECT id, username, email, display_name, avatar_url, banner_color, bio, status_mode, status_text, created_at FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  } else {
    const u = memoryStore.users.find(x => x.id === parseInt(id));
    if (!u) return null;
    const { password, ...safe } = u;
    return safe;
  }
}

async function createUser({ username, email, password, displayName, avatarUrl }) {
  const finalDisplay = displayName || username;
  const finalAvatar = avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

  if (isPostgres) {
    const res = await pool.query(
      `INSERT INTO users (username, email, password, display_name, avatar_url) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, username, email, display_name, avatar_url, banner_color, bio, status_mode, status_text, created_at`,
      [username, email, password, finalDisplay, finalAvatar]
    );
    const user = res.rows[0];

    // Auto-join default server if exists
    const srv = await pool.query('SELECT id FROM servers WHERE invite_code = $1', ['AMIGOS10']);
    if (srv.rows.length > 0) {
      await pool.query(
        'INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [srv.rows[0].id, user.id, 'member']
      );
    }
    return user;
  } else {
    const id = memoryStore.nextIds.user++;
    const user = {
      id,
      username,
      email,
      password,
      display_name: finalDisplay,
      avatar_url: finalAvatar,
      banner_color: '#5865F2',
      bio: '',
      status_mode: 'online',
      status_text: '',
      created_at: new Date()
    };
    memoryStore.users.push(user);
    // Auto-join default server
    const srv = memoryStore.servers.find(s => s.invite_code === 'AMIGOS10');
    if (srv) {
      memoryStore.server_members.push({ server_id: srv.id, user_id: id, role: 'member', joined_at: new Date() });
    }
    const { password: _, ...safe } = user;
    return safe;
  }
}

async function updateUserProfile(id, { displayName, avatarUrl, bannerColor, bio, statusMode, statusText }) {
  if (isPostgres) {
    const res = await pool.query(
      `UPDATE users 
       SET display_name = COALESCE($1, display_name),
           avatar_url = COALESCE($2, avatar_url),
           banner_color = COALESCE($3, banner_color),
           bio = COALESCE($4, bio),
           status_mode = COALESCE($5, status_mode),
           status_text = COALESCE($6, status_text)
       WHERE id = $7
       RETURNING id, username, email, display_name, avatar_url, banner_color, bio, status_mode, status_text`,
      [displayName, avatarUrl, bannerColor, bio, statusMode, statusText, id]
    );
    return res.rows[0];
  } else {
    const user = memoryStore.users.find(u => u.id === parseInt(id));
    if (!user) return null;
    if (displayName !== undefined) user.display_name = displayName;
    if (avatarUrl !== undefined) user.avatar_url = avatarUrl;
    if (bannerColor !== undefined) user.banner_color = bannerColor;
    if (bio !== undefined) user.bio = bio;
    if (statusMode !== undefined) user.status_mode = statusMode;
    if (statusText !== undefined) user.status_text = statusText;
    const { password, ...safe } = user;
    return safe;
  }
}

// Servers
async function getUserServers(userId) {
  if (isPostgres) {
    const res = await pool.query(
      `SELECT s.* FROM servers s 
       JOIN server_members sm ON sm.server_id = s.id 
       WHERE sm.user_id = $1 
       ORDER BY s.id ASC`,
      [userId]
    );
    return res.rows;
  } else {
    const memberships = memoryStore.server_members.filter(m => m.user_id === parseInt(userId));
    const serverIds = memberships.map(m => m.server_id);
    return memoryStore.servers.filter(s => serverIds.includes(s.id));
  }
}

async function createServer({ name, iconUrl, ownerId }) {
  const inviteCode = 'INV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const icon = iconUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`;

  if (isPostgres) {
    const res = await pool.query(
      'INSERT INTO servers (name, icon_url, owner_id, invite_code) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, icon, ownerId, inviteCode]
    );
    const server = res.rows[0];
    await pool.query('INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, $3)', [server.id, ownerId, 'owner']);

    // Default channels
    await pool.query('INSERT INTO channels (server_id, name, type, topic) VALUES ($1, $2, $3, $4)', [server.id, 'geral', 'text', 'Canal de texto principal']);
    await pool.query('INSERT INTO channels (server_id, name, type, topic) VALUES ($1, $2, $3, $4)', [server.id, 'Geral Voz', 'voice', 'Canal de voz principal']);

    return server;
  } else {
    const srv = {
      id: memoryStore.nextIds.server++,
      name,
      icon_url: icon,
      owner_id: parseInt(ownerId),
      invite_code: inviteCode,
      created_at: new Date()
    };
    memoryStore.servers.push(srv);
    memoryStore.server_members.push({ server_id: srv.id, user_id: parseInt(ownerId), role: 'owner', joined_at: new Date() });
    memoryStore.channels.push({ id: memoryStore.nextIds.channel++, server_id: srv.id, name: 'geral', type: 'text', topic: 'Canal de texto principal' });
    memoryStore.channels.push({ id: memoryStore.nextIds.channel++, server_id: srv.id, name: 'Geral Voz', type: 'voice', topic: 'Canal de voz principal' });
    return srv;
  }
}

async function joinServerByInvite(inviteCode, userId) {
  if (isPostgres) {
    const srv = await pool.query('SELECT * FROM servers WHERE LOWER(invite_code) = LOWER($1)', [inviteCode.trim()]);
    if (srv.rows.length === 0) return null;
    const server = srv.rows[0];
    await pool.query(
      'INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [server.id, userId, 'member']
    );
    return server;
  } else {
    const srv = memoryStore.servers.find(s => s.invite_code.toLowerCase() === inviteCode.trim().toLowerCase());
    if (!srv) return null;
    const already = memoryStore.server_members.some(m => m.server_id === srv.id && m.user_id === parseInt(userId));
    if (!already) {
      memoryStore.server_members.push({ server_id: srv.id, user_id: parseInt(userId), role: 'member', joined_at: new Date() });
    }
    return srv;
  }
}

async function getServerChannels(serverId) {
  if (isPostgres) {
    const res = await pool.query('SELECT * FROM channels WHERE server_id = $1 ORDER BY type ASC, id ASC', [serverId]);
    return res.rows;
  } else {
    return memoryStore.channels.filter(c => c.server_id === parseInt(serverId));
  }
}

async function createChannel({ serverId, name, type, topic }) {
  const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-');
  if (isPostgres) {
    const res = await pool.query(
      'INSERT INTO channels (server_id, name, type, topic) VALUES ($1, $2, $3, $4) RETURNING *',
      [serverId, cleanName, type || 'text', topic || '']
    );
    return res.rows[0];
  } else {
    const ch = {
      id: memoryStore.nextIds.channel++,
      server_id: parseInt(serverId),
      name: cleanName,
      type: type || 'text',
      topic: topic || '',
      created_at: new Date()
    };
    memoryStore.channels.push(ch);
    return ch;
  }
}

async function getServerMembers(serverId) {
  if (isPostgres) {
    const res = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.status_mode, u.status_text, sm.role
       FROM server_members sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.server_id = $1
       ORDER BY sm.role DESC, u.display_name ASC`,
      [serverId]
    );
    return res.rows;
  } else {
    const members = memoryStore.server_members.filter(m => m.server_id === parseInt(serverId));
    return members.map(m => {
      const u = memoryStore.users.find(x => x.id === m.user_id);
      return {
        id: u ? u.id : m.user_id,
        username: u ? u.username : 'desconhecido',
        display_name: u ? u.display_name : 'Membro',
        avatar_url: u ? u.avatar_url : '',
        status_mode: u ? u.status_mode : 'offline',
        status_text: u ? u.status_text : '',
        role: m.role
      };
    });
  }
}

// Messages
async function getChannelMessages(channelId, limit = 50) {
  if (isPostgres) {
    const res = await pool.query(
      `SELECT m.*, u.username, u.display_name, u.avatar_url, u.banner_color
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2`,
      [channelId, limit]
    );
    return res.rows.reverse();
  } else {
    const msgs = memoryStore.messages
      .filter(m => m.channel_id === parseInt(channelId))
      .slice(-limit)
      .map(m => {
        const u = memoryStore.users.find(x => x.id === m.user_id);
        return {
          ...m,
          username: u ? u.username : 'usuário',
          display_name: u ? u.display_name : 'Usuário',
          avatar_url: u ? u.avatar_url : '',
          banner_color: u ? u.banner_color : '#5865F2'
        };
      });
    return msgs;
  }
}

async function createMessage({ channelId, userId, content, attachments = [] }) {
  if (isPostgres) {
    const res = await pool.query(
      `INSERT INTO messages (channel_id, user_id, content, attachments) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [channelId, userId, content, JSON.stringify(attachments)]
    );
    const msg = res.rows[0];
    const u = await pool.query('SELECT username, display_name, avatar_url, banner_color FROM users WHERE id = $1', [userId]);
    return { ...msg, ...(u.rows[0] || {}) };
  } else {
    const msg = {
      id: memoryStore.nextIds.message++,
      channel_id: parseInt(channelId),
      user_id: parseInt(userId),
      content,
      attachments,
      created_at: new Date()
    };
    memoryStore.messages.push(msg);
    const u = memoryStore.users.find(x => x.id === parseInt(userId));
    return {
      ...msg,
      username: u ? u.username : 'usuário',
      display_name: u ? u.display_name : 'Usuário',
      avatar_url: u ? u.avatar_url : '',
      banner_color: u ? u.banner_color : '#5865F2'
    };
  }
}

function getDatabaseStatus() {
  return {
    isPostgres,
    type: isPostgres ? 'Neon PostgreSQL (Cloud)' : 'Armazenamento Local (Memória)',
    urlConfigured: !!process.env.DATABASE_URL
  };
}

module.exports = {
  initDB,
  getUserByEmailOrUsername,
  getUserById,
  createUser,
  updateUserProfile,
  getUserServers,
  createServer,
  joinServerByInvite,
  getServerChannels,
  createChannel,
  getServerMembers,
  getChannelMessages,
  createMessage,
  getDatabaseStatus
};
