// Configuração central do DvD.
// Nenhum segredo fica no código: tudo vem de variáveis de ambiente.
require('dotenv').config();
const crypto = require('crypto');

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

// Segredos que já foram publicados no repositório (ou são óbvios) e por isso
// NUNCA podem ser aceitos como chave de assinatura.
const BLOCKED_JWT_SECRETS = new Set([
  'discord-super-secret-key-neon-render-2026',
  'dvd-secret-jwt-key-neon-2026-super-secure',
  'secret',
  'changeme',
  'troque-por-uma-chave-longa-e-aleatoria'
]);

let jwtSecret = process.env.JWT_SECRET || '';
let jwtSecretGenerated = false;
if (jwtSecret.length < 32 || BLOCKED_JWT_SECRETS.has(jwtSecret)) {
  // Gera uma chave aleatória a cada boot. As sessões são invalidadas ao reiniciar,
  // mas o servidor nunca roda com uma chave previsível.
  jwtSecret = crypto.randomBytes(48).toString('hex');
  jwtSecretGenerated = true;
}

const intEnv = (name, fallback) => {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

let firebaseCredentials = null;
try {
  if (process.env.FIREBASE_CREDENTIALS) {
    firebaseCredentials = JSON.parse(process.env.FIREBASE_CREDENTIALS);
  } else {
    // Tenta carregar do arquivo local ignorado pelo git
    const fs = require('fs');
    const path = require('path');
    const p = path.join(__dirname, 'firebase-service-account.json');
    if (fs.existsSync(p)) {
      firebaseCredentials = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
} catch (err) {
  console.warn(' Aviso: FIREBASE_CREDENTIALS inválido.');
}

module.exports = {
  NODE_ENV,
  IS_PROD,
  FIREBASE_CREDENTIALS: firebaseCredentials,
  PORT: intEnv('PORT', 3001),
  JWT_SECRET: jwtSecret,
  JWT_SECRET_GENERATED: jwtSecretGenerated,
  JWT_EXPIRES_IN: '7d',
  BCRYPT_COST: IS_PROD ? 12 : 10,

  // Origens extras permitidas (separadas por vírgula). Por padrão: apenas mesma origem.
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // LGPD: canal de contato do controlador/encarregado (DPO)
  PRIVACY_CONTACT: process.env.PRIVACY_CONTACT || '',

  // TURN opcional (melhora conexões atrás de NAT restritivo e esconde o IP dos pares)
  TURN_URLS: (process.env.TURN_URLS || '').split(',').map((s) => s.trim()).filter(Boolean),
  TURN_USERNAME: process.env.TURN_USERNAME || '',
  TURN_CREDENTIAL: process.env.TURN_CREDENTIAL || '',

  // Limites de produto
  LIMITS: {
    MAX_SERVERS_OWNED: 10,
    MAX_SERVERS_JOINED: 50,
    MAX_MEMBERS_PER_SERVER: 50,
    MAX_CHANNELS_PER_SERVER: 30,
    MAX_FRIENDS: 200,
    MAX_MESSAGE_LENGTH: 4000,
    MAX_ATTACHMENTS: 4,
    MAX_DATA_URL_BYTES: 1_800_000,
    MAX_AVATAR_BYTES: 300_000
  },

  // Rate limits (podem ser ajustados por ambiente em testes)
  RATE: {
    GLOBAL_PER_MIN: intEnv('RATE_GLOBAL_PER_MIN', 600),
    REGISTER_PER_HOUR: intEnv('RATE_REGISTER_PER_HOUR', 20),
    LOGIN_FAILS_PER_15MIN: intEnv('RATE_LOGIN_FAILS_PER_15MIN', 30),
    RESET_PER_HOUR: intEnv('RATE_RESET_PER_HOUR', 10),
    INVITE_FAILS_PER_10MIN: intEnv('RATE_INVITE_FAILS_PER_10MIN', 15),
    FRIEND_REQ_PER_10MIN: intEnv('RATE_FRIEND_REQ_PER_10MIN', 25),
    MESSAGES_PER_MIN: intEnv('RATE_MESSAGES_PER_MIN', 90)
  },

  LOCKOUT: {
    MAX_FAILS: 5,
    MINUTES: 15
  },

  CONSENT_VERSION: '2026-10'
};
