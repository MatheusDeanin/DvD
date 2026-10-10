// Utilitários de segurança do DvD: cabeçalhos, rate limiting, validação e tokens.
const crypto = require('crypto');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const cfg = require('./config');

// ---------------------------------------------------------------------------
// Erros HTTP controlados (a mensagem é segura para o usuário final)
// ---------------------------------------------------------------------------
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------------------------------------------------------------------------
// Validação / sanitização
// ---------------------------------------------------------------------------
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const STATUS_MODES = ['online', 'idle', 'dnd', 'offline'];

// Remove caracteres de controle (exceto \n e \t) e normaliza o texto.
function cleanText(value, max) {
  if (typeof value !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const v = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '').normalize('NFC');
  return max ? v.slice(0, max) : v;
}

function isValidId(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 && value <= 2147483647;
  if (typeof value === 'string') return /^[0-9]{1,10}$/.test(value) && Number(value) > 0 && Number(value) <= 2147483647;
  return false;
}
const toId = (value) => (isValidId(value) ? Number(value) : null);

const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123', 'qwerty123', 'qwertyuiop',
  'abcdefgh', 'abc12345', 'iloveyou1', 'senha123', 'senha1234', 'mudar123', '11111111', '00000000',
  'admin123', 'letmein123', 'welcome1', 'brasil123', 'discord123', 'dvd12345', 'abcd1234', 'qwerty12'
]);

function validatePassword(password, username = '') {
  if (typeof password !== 'string') return 'Senha inválida.';
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (Buffer.byteLength(password, 'utf8') > 72) return 'A senha deve ter no máximo 72 bytes (cerca de 72 caracteres).';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'A senha deve conter letras e números.';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'Essa senha é muito comum. Escolha outra.';
  if (username && password.toLowerCase().includes(String(username).toLowerCase()) && String(username).length >= 3) {
    return 'A senha não pode conter o seu nome de usuário.';
  }
  return null;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1 (ambíguos)
function randomCode(length) {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return out;
}
const generateInviteCode = () => randomCode(10);
const generateFriendCode = () => `DVD-${randomCode(4)}-${randomCode(4)}`;
const generateRecoveryCode = () => `${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`;

function normalizeFriendCode(input) {
  if (typeof input !== 'string') return null;
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = raw.startsWith('DVD') ? raw.slice(3) : raw;
  if (!/^[A-Z0-9]{8}$/.test(body)) return null;
  return `DVD-${body.slice(0, 4)}-${body.slice(4)}`;
}
function normalizeRecoveryCode(input) {
  if (typeof input !== 'string') return null;
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{12}$/.test(raw)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}
function normalizeInviteCode(input) {
  if (typeof input !== 'string') return null;
  const v = input.trim().toUpperCase();
  return /^[A-Z0-9-]{4,30}$/.test(v) ? v : null;
}

// Assinaturas (magic bytes) de imagens permitidas.
function matchesImageSignature(mime, b64) {
  let head;
  try {
    head = Buffer.from(b64.slice(0, 48), 'base64');
  } catch {
    return false;
  }
  if (mime === 'png') return head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === 'jpeg') return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (mime === 'gif') return head.length >= 6 && /^GIF8[79]a$/.test(head.subarray(0, 6).toString('latin1'));
  if (mime === 'webp') return head.length >= 12 && head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP';
  return false;
}

// Aceita somente imagens enviadas como data URL (hospedadas por nós). URLs externas
// são recusadas: evitam pixels de rastreamento e vazamento de IP (LGPD) além de XSS.
function sanitizeImageDataUrl(url, maxBytes) {
  if (typeof url !== 'string') return null;
  const m = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
  if (!m) return null;
  if (url.length > maxBytes) return null;
  if (!matchesImageSignature(m[1], m[2])) return null;
  return url;
}

function sanitizeAttachments(input) {
  if (input === undefined || input === null) return { ok: true, value: [] };
  if (!Array.isArray(input) || input.length > cfg.LIMITS.MAX_ATTACHMENTS) return { ok: false };
  const out = [];
  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false };
    const url = sanitizeImageDataUrl(item.url, cfg.LIMITS.MAX_DATA_URL_BYTES);
    if (!url) return { ok: false };
    out.push({ type: 'image', url });
  }
  return { ok: true, value: out };
}

// Valida e normaliza o conteúdo de uma mensagem (canal, DM ou socket).
function sanitizeMessagePayload(content, attachments) {
  const text = content === undefined || content === null ? '' : cleanText(content);
  if (text === null) return { error: 'Mensagem inválida.' };
  if (text.length > cfg.LIMITS.MAX_MESSAGE_LENGTH) {
    return { error: `A mensagem pode ter no máximo ${cfg.LIMITS.MAX_MESSAGE_LENGTH} caracteres.` };
  }
  const att = sanitizeAttachments(attachments);
  if (!att.ok) return { error: 'Anexo inválido. Envie apenas imagens PNG, JPG, GIF ou WEBP (até ~1 MB).' };
  const trimmed = text.trim();
  if (!trimmed && att.value.length === 0) return { error: 'Mensagem vazia.' };
  return { content: trimmed, attachments: att.value };
}

function sanitizeProfile(body) {
  const out = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Dados inválidos.' };
  if (body.displayName !== undefined) {
    const v = cleanText(body.displayName, 40);
    if (v === null || v.trim().length < 1 || v.trim().length > 32) return { error: 'O nome de exibição deve ter de 1 a 32 caracteres.' };
    out.displayName = v.trim();
  }
  if (body.bio !== undefined) {
    const v = cleanText(body.bio);
    if (v === null || v.length > 190) return { error: 'A bio deve ter no máximo 190 caracteres.' };
    out.bio = v;
  }
  if (body.statusText !== undefined) {
    const v = cleanText(body.statusText);
    if (v === null || v.length > 100) return { error: 'O status deve ter no máximo 100 caracteres.' };
    out.statusText = v;
  }
  if (body.statusMode !== undefined) {
    if (typeof body.statusMode !== 'string' || !STATUS_MODES.includes(body.statusMode)) return { error: 'Modo de status inválido.' };
    out.statusMode = body.statusMode;
  }
  if (body.bannerColor !== undefined) {
    if (typeof body.bannerColor !== 'string' || !HEX_COLOR_RE.test(body.bannerColor)) return { error: 'Cor de banner inválida (use #RRGGBB).' };
    out.bannerColor = body.bannerColor;
  }
  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl === null || body.avatarUrl === '') {
      out.avatarUrl = null; // volta ao avatar gerado localmente
    } else {
      const url = sanitizeImageDataUrl(body.avatarUrl, cfg.LIMITS.MAX_AVATAR_BYTES);
      if (!url) return { error: 'Avatar inválido. Envie uma imagem PNG, JPG, GIF ou WEBP de até ~200 KB.' };
      out.avatarUrl = url;
    }
  }
  return { value: out };
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
function signToken(user) {
  return jwt.sign({ sub: user.id, tv: user.token_version || 0 }, cfg.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: cfg.JWT_EXPIRES_IN
  });
}
function verifyToken(token) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  try {
    const payload = jwt.verify(token, cfg.JWT_SECRET, { algorithms: ['HS256'] });
    if (!isValidId(payload.sub)) return null;
    return { id: Number(payload.sub), tv: Number(payload.tv) || 0 };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cabeçalhos HTTP, CORS e HTTPS
// ---------------------------------------------------------------------------
function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'", 'ws:', 'wss:'],
        'media-src': ["'self'", 'blob:', 'mediastream:'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'worker-src': ["'self'", 'blob:']
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
    frameguard: { action: 'deny' },
    xPoweredBy: false
  });
}

// Permissions-Policy: câmera/microfone/tela apenas na própria origem.
function permissionsPolicy(req, res, next) {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()');
  next();
}

function isOriginAllowed(origin, host) {
  if (!origin) return true; // chamadas não-browser (curl, apps) não enviam Origin
  try {
    const u = new URL(origin);
    if (host && u.host === host) return true;
  } catch {
    return false;
  }
  return cfg.ALLOWED_ORIGINS.includes(origin);
}

// Bloqueia requisições cross-origin mutáveis (defesa em profundidade contra CSRF;
// como a autenticação usa o header Authorization e não cookies, o risco já é baixo).
function originGuard(req, res, next) {
  const origin = req.headers.origin;
  if (origin && !isOriginAllowed(origin, req.headers.host)) {
    return res.status(403).json({ error: 'Origem não permitida.' });
  }
  next();
}

function httpsRedirect(req, res, next) {
  if (!cfg.IS_PROD) return next();
  const proto = req.headers['x-forwarded-proto'];
  if (!proto || String(proto).split(',')[0].trim() === 'https') return next();
  if (req.path === '/api/health') return next();
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  }
  return res.status(400).json({ error: 'Use HTTPS.' });
}

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------
const tooMany = (msg) => ({ error: msg });
const limiterBase = { standardHeaders: 'draft-7', legacyHeaders: false };

const userKey = (req) => (req.user ? `u${req.user.id}` : `ip${req.ip}`);

const limiters = {
  global: rateLimit({
    ...limiterBase,
    windowMs: 60 * 1000,
    limit: cfg.RATE.GLOBAL_PER_MIN,
    skip: (req) => req.path === '/api/health',
    message: tooMany('Muitas requisições. Aguarde um instante.')
  }),
  register: rateLimit({
    ...limiterBase,
    windowMs: 60 * 60 * 1000,
    limit: cfg.RATE.REGISTER_PER_HOUR,
    message: tooMany('Muitos cadastros a partir desta rede. Tente novamente mais tarde.')
  }),
  // Apenas tentativas FALHAS contam (o bloqueio por conta é feito no banco).
  login: rateLimit({
    ...limiterBase,
    windowMs: 15 * 60 * 1000,
    limit: cfg.RATE.LOGIN_FAILS_PER_15MIN,
    skipSuccessfulRequests: true,
    message: tooMany('Muitas tentativas de login. Aguarde alguns minutos.')
  }),
  reset: rateLimit({
    ...limiterBase,
    windowMs: 60 * 60 * 1000,
    limit: cfg.RATE.RESET_PER_HOUR,
    message: tooMany('Muitas tentativas de recuperação. Tente novamente mais tarde.')
  }),
  inviteGuess: rateLimit({
    ...limiterBase,
    windowMs: 10 * 60 * 1000,
    limit: cfg.RATE.INVITE_FAILS_PER_10MIN,
    skipSuccessfulRequests: true,
    keyGenerator: userKey,
    validate: { keyGeneratorIpFallback: false },
    message: tooMany('Muitos códigos inválidos. Aguarde alguns minutos.')
  }),
  friendRequest: rateLimit({
    ...limiterBase,
    windowMs: 10 * 60 * 1000,
    limit: cfg.RATE.FRIEND_REQ_PER_10MIN,
    keyGenerator: userKey,
    validate: { keyGeneratorIpFallback: false },
    message: tooMany('Muitos pedidos de amizade. Aguarde alguns minutos.')
  }),
  messages: rateLimit({
    ...limiterBase,
    windowMs: 60 * 1000,
    limit: cfg.RATE.MESSAGES_PER_MIN,
    keyGenerator: userKey,
    validate: { keyGeneratorIpFallback: false },
    message: tooMany('Você está enviando mensagens rápido demais.')
  }),
  sensitive: rateLimit({
    ...limiterBase,
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: userKey,
    validate: { keyGeneratorIpFallback: false },
    message: tooMany('Muitas tentativas. Aguarde alguns minutos.')
  })
};

// Token bucket simples para eventos de WebSocket.
function createBucket(capacity, refillPerSec) {
  let tokens = capacity;
  let last = Date.now();
  return () => {
    const now = Date.now();
    tokens = Math.min(capacity, tokens + ((now - last) / 1000) * refillPerSec);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

module.exports = {
  HttpError,
  asyncHandler,
  USERNAME_RE,
  STATUS_MODES,
  cleanText,
  isValidId,
  toId,
  validatePassword,
  generateInviteCode,
  generateFriendCode,
  generateRecoveryCode,
  normalizeFriendCode,
  normalizeRecoveryCode,
  normalizeInviteCode,
  sanitizeImageDataUrl,
  sanitizeAttachments,
  sanitizeMessagePayload,
  sanitizeProfile,
  signToken,
  verifyToken,
  securityHeaders,
  permissionsPolicy,
  originGuard,
  isOriginAllowed,
  httpsRedirect,
  limiters,
  createBucket
};
