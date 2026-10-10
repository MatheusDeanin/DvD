const db = require('./db');
const { createApp } = require('./app');
const cfg = require('./config');
const { startKeepAlive } = require('./keepAlive');

// O Render (e nosso script de testes) espera que a aplicação exponha e escute a PORTA configurada.
const { server } = createApp();

async function start() {
  try {
    await db.initDB();
  } catch (err) {
    console.error('❌ Falha ao inicializar o banco de dados:', err.message);
    process.exit(1);
  }

  server.listen(cfg.PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 DvD ONLINE NA PORTA: ${cfg.PORT}`);
    console.log(`🔗 Local URL: http://localhost:${cfg.PORT}`);
    console.log(`🗄️  Banco: ${db.getDatabaseStatus().type}`);
    console.log(`🔒 Ambiente: ${cfg.IS_PROD ? 'Produção' : 'Desenvolvimento'} / JWT Auto-gerado: ${cfg.JWT_SECRET_GENERATED ? 'Sim' : 'Não'}`);
    console.log(`======================================================\n`);

    // Inicializa o ping para evitar que a aplicação durma no Render.
    startKeepAlive();
  });
}

start();
