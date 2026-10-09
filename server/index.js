require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const db = require('./db');
const { setupSocketIO, getVoiceOccupants } = require('./socket');
const { startKeepAlive, executePing, getKeepAliveStatus } = require('./keepAlive');

const app = express();
const server = http.createServer(app);

// CORS for development and production
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '15mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'discord-super-secret-key-neon-render-2026';
const PORT = process.env.PORT || 3001;

// Setup Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
setupSocketIO(io);

// JWT Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

// ========================
// AUTH ROUTES
// ========================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, displayName, avatarUrl } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Preencha nome de usuário, e-mail e senha.' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'O nome de usuário deve ter pelo menos 3 caracteres.' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 4 caracteres.' });
    }

    // Check if exists
    const existing = await db.getUserByEmailOrUsername(email);
    const existingUser = await db.getUserByEmailOrUsername(username);

    if (existing || existingUser) {
      return res.status(400).json({ error: 'Nome de usuário ou e-mail já cadastrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.createUser({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      displayName: displayName || username,
      avatarUrl
    });

    const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ error: 'Erro ao registrar usuário: ' + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Informe e-mail/usuário e senha.' });
    }

    const user = await db.getUserByEmailOrUsername(login.trim());
    if (!user) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro ao realizar login: ' + err.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// USER PROFILE ROUTES
// ========================
app.put('/api/users/profile', authMiddleware, async (req, res) => {
  try {
    const updated = await db.updateUserProfile(req.user.id, req.body);
    // Broadcast status change to peers if status changed
    if (req.body.statusMode || req.body.statusText) {
      io.emit('user_profile_updated', updated);
    }
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// SERVERS & CHANNELS ROUTES
// ========================
app.get('/api/servers', authMiddleware, async (req, res) => {
  try {
    const servers = await db.getUserServers(req.user.id);
    res.json({ servers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers', authMiddleware, async (req, res) => {
  try {
    const { name, iconUrl } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Nome do servidor é obrigatório.' });
    }
    const server = await db.createServer({
      name: name.trim(),
      iconUrl,
      ownerId: req.user.id
    });
    res.status(201).json({ server });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers/join', authMiddleware, async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) {
      return res.status(400).json({ error: 'Código de convite é obrigatório.' });
    }
    const server = await db.joinServerByInvite(inviteCode, req.user.id);
    if (!server) {
      return res.status(404).json({ error: 'Servidor não encontrado com este código de convite.' });
    }
    res.json({ server });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/servers/:serverId/channels', authMiddleware, async (req, res) => {
  try {
    const channels = await db.getServerChannels(req.params.serverId);
    // Attach voice occupant counts
    const channelsWithOccupants = channels.map(ch => ({
      ...ch,
      occupants: ch.type === 'voice' ? getVoiceOccupants(ch.id) : []
    }));
    res.json({ channels: channelsWithOccupants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers/:serverId/channels', authMiddleware, async (req, res) => {
  try {
    const { name, type, topic } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nome do canal é obrigatório.' });
    }
    const channel = await db.createChannel({
      serverId: req.params.serverId,
      name,
      type: type || 'text',
      topic: topic || ''
    });
    io.emit('channel_created', { serverId: req.params.serverId, channel });
    res.status(201).json({ channel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/servers/:serverId/members', authMiddleware, async (req, res) => {
  try {
    const members = await db.getServerMembers(req.params.serverId);
    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// MESSAGES ROUTE
// ========================
app.get('/api/channels/:channelId/messages', authMiddleware, async (req, res) => {
  try {
    const messages = await db.getChannelMessages(req.params.channelId);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// HEALTH & RENDER ANTI-SLEEP ROUTES
// ========================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: db.getDatabaseStatus(),
    renderAntiSleep: getKeepAliveStatus()
  });
});

app.get('/api/keep-alive/status', (req, res) => {
  res.json(getKeepAliveStatus());
});

app.post('/api/keep-alive/trigger', async (req, res) => {
  const result = await executePing();
  res.json({ result, status: getKeepAliveStatus() });
});

app.post('/api/keep-alive/configure', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL é obrigatória' });
  startKeepAlive(url);
  res.json({ success: true, status: getKeepAliveStatus() });
});

// ========================
// SERVE CLIENT STATIC FILES
// ========================
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // In dev mode or before client build, respond with helpful status
      res.status(200).send(`
        <html>
          <body style="font-family: sans-serif; background: #2f3136; color: #fff; padding: 2rem; text-align: center;">
            <h2>🚀 Servidor Discord Clone Ativo!</h2>
            <p>API e WebSockets funcionando perfeitamente na porta ${PORT}.</p>
            <p>Para visualizar a interface completa do Discord, execute o build do cliente ou inicie com <code>npm run dev</code>.</p>
          </body>
        </html>
      `);
    }
  });
});

// Start server
async function start() {
  await db.initDB();

  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 DISCORD CLONE ONLINE NA PORTA: ${PORT}`);
    console.log(`🔗 Local URL: http://localhost:${PORT}`);
    console.log(`🗄️  Banco: ${db.getDatabaseStatus().type}`);
    console.log(`======================================================\n`);

    // Initialize Render Anti-Sleep Keep Alive Engine
    startKeepAlive();
  });
}

start().catch(err => {
  console.error('❌ Falha ao iniciar servidor:', err);
});
