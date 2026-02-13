require('dotenv').config();

const config = require('./backend/config');
const logger = require('./backend/utils/logger');
const { createApp, detectLocalIP } = require('./backend/app');

const HTTPS_PORT = 3443;
const runtime = createApp({ httpsPort: HTTPS_PORT });

async function start() {
  try {
    const ports = await runtime.startServer({ port: config.port, httpsPort: HTTPS_PORT });
    const localIP = detectLocalIP();

    logger.info('HTTP server started', { port: ports.port, env: config.env });
    if (ports.httpsPort) {
      logger.info('HTTPS server started', { port: ports.httpsPort });
    }

    const httpsInfo = ports.httpsPort
      ? `\n║   📱 HTTPS (Mobile): https://${localIP}:${ports.httpsPort}`.padEnd(72) + '║'
      : '';
    const banner = `
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   🔐 E2E ENCRYPTED MESSENGER SERVER v3.0                             ║
║                                                                      ║
║   Environment: ${config.env.padEnd(51)}║
║   🖥️  HTTP:  http://${localIP}:${ports.port}`.padEnd(72) + `║${httpsInfo}
║                                                                      ║
║   Features:                                                          ║
║   • End-to-end encryption (AES-256-GCM + ECDH P-256)                 ║
║   • JWT authentication with refresh tokens                           ║
║   • File upload support (images, documents)                          ║
║   • SQLite persistence                                               ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
    `;
    console.log(banner);
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down`);
  try {
    await runtime.stopServer();
    process.exit(0);
  } catch (error) {
    logger.error('Shutdown failed', { error: error.message });
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

start();

