// Anti-Sleep Keep-Alive Engine for Render.com
const https = require('https');
const http = require('http');

let keepAliveInterval = null;
let stats = {
  active: false,
  targetUrl: null,
  totalPings: 0,
  successfulPings: 0,
  failedPings: 0,
  lastPingTime: null,
  lastPingStatus: null,
  lastResponseTimeMs: null,
  intervalMinutes: 10
};

function pingUrl(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      
      const req = client.get(url, { timeout: 15000 }, (res) => {
        const responseTime = Date.now() - startTime;
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            responseTime,
            status: res.statusCode >= 200 && res.statusCode < 400 ? 'OK' : 'ERROR'
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout ao conectar com a URL'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

function startKeepAlive(customUrl = null) {
  // Render sets RENDER_EXTERNAL_URL automatically (e.g. https://meu-discord.onrender.com)
  const target = customUrl || process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;

  if (!target) {
    stats.active = false;
    stats.targetUrl = null;
    console.log('ℹ️ Keep-Alive: Nenhuma URL externa (RENDER_EXTERNAL_URL ou APP_URL) definida. O self-ping ficará em espera até ser configurada.');
    return;
  }

  // Format health endpoint
  let pingTarget = target.trim();
  if (!pingTarget.startsWith('http://') && !pingTarget.startsWith('https://')) {
    pingTarget = 'https://' + pingTarget;
  }
  if (!pingTarget.endsWith('/api/health')) {
    pingTarget = pingTarget.replace(/\/$/, '') + '/api/health';
  }

  stats.targetUrl = pingTarget;
  stats.active = true;

  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  console.log(`🚀 Anti-Sleep Keep-Alive iniciado! Pingando: ${pingTarget} a cada ${stats.intervalMinutes} minutos.`);

  // First ping shortly after startup
  setTimeout(async () => {
    await executePing();
  }, 30000); // 30 seconds after start

  // Repeat every 10 minutes (well before Render's 15 minute inactivity timeout)
  keepAliveInterval = setInterval(async () => {
    await executePing();
  }, stats.intervalMinutes * 60 * 1000);
}

async function executePing() {
  if (!stats.targetUrl) return null;

  stats.totalPings++;
  stats.lastPingTime = new Date().toISOString();

  try {
    const res = await pingUrl(stats.targetUrl);
    stats.successfulPings++;
    stats.lastPingStatus = `Sucesso (${res.statusCode}) - ${res.responseTime}ms`;
    stats.lastResponseTimeMs = res.responseTime;
    console.log(`[Anti-Sleep] Ping executado com sucesso: ${stats.targetUrl} - ${res.responseTime}ms`);
    return { success: true, ...res };
  } catch (err) {
    stats.failedPings++;
    stats.lastPingStatus = `Falha: ${err.message}`;
    console.warn(`⚠️ [Anti-Sleep] Falha no ping para ${stats.targetUrl}:`, err.message);
    return { success: false, error: err.message };
  }
}

function getKeepAliveStatus() {
  return {
    ...stats,
    serverUptimeSeconds: Math.floor(process.uptime()),
    renderDetected: !!process.env.RENDER || !!process.env.RENDER_EXTERNAL_URL
  };
}

module.exports = {
  startKeepAlive,
  executePing,
  getKeepAliveStatus
};
