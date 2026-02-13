const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const config = require('./config');
const db = require('./database/db');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiRateLimiter } = require('./middleware/rateLimiter');
const { authRoutes, roomRoutes, fileRoutes } = require('./routes');
const setupSocketHandlers = require('./socket');

function detectLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function createApp(options = {}) {
  const httpsPort = options.httpsPort || 3443;
  const enableHttps = options.enableHttps !== false;
  const staticDir = options.staticDir || path.join(__dirname, '..', 'public_build');
  const sslKeyPath = options.sslKeyPath || path.join(__dirname, '..', 'ssl', 'key.pem');
  const sslCertPath = options.sslCertPath || path.join(__dirname, '..', 'ssl', 'cert.pem');

  const app = express();
  const server = http.createServer(app);
  let httpsServer = null;
  let started = false;
  let socketHandlersReady = false;

  if (enableHttps && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    try {
      const sslOptions = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath),
      };
      httpsServer = https.createServer(sslOptions, app);
    } catch (err) {
      logger.warn('HTTPS disabled, failed to load certs', { error: err.message });
      httpsServer = null;
    }
  }

  const io = new Server({
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });
  io.attach(server);
  if (httpsServer) {
    io.attach(httpsServer);
  }

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: config.security.csp.directives,
    },
  }));

  app.use(requestLogger);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (req, res) => {
    const stats = db.getStats();
    const dbWritable = (() => {
      try {
        db.saveDatabase();
        return true;
      } catch (error) {
        return false;
      }
    })();
    const uploadDirectoryAccessible = (() => {
      try {
        fs.accessSync(config.upload.directory, fs.constants.R_OK | fs.constants.W_OK);
        return true;
      } catch (error) {
        return false;
      }
    })();
    const envValidation = Boolean(process.env.JWT_SECRET && process.env.JWT_REFRESH_SECRET);
    const dependencies = {
      database: dbWritable ? 'up' : 'down',
      uploadStorage: uploadDirectoryAccessible ? 'up' : 'down',
      environment: envValidation ? 'up' : 'down',
    };
    const degraded = Object.values(dependencies).includes('down');

    res.json({
      status: degraded ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      stats,
      dependencies,
    });
  });

  app.get('/api/network-info', (req, res) => {
    const localIP = detectLocalIP();
    res.json({
      url: `https://${localIP}:${httpsPort}`,
      httpUrl: `http://${localIP}:${config.port}`,
      httpsUrl: `https://${localIP}:${httpsPort}`,
      ip: localIP,
      port: config.port,
      httpsPort,
    });
  });

  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/files/') && req.method === 'GET') {
      return next();
    }
    return apiRateLimiter(req, res, next);
  });

  app.use(express.static(staticDir));
  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/files', fileRoutes);

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(staticDir, 'index.html'));
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  function closeWithTimeout(closeFn, timeoutMs = 2000) {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve();
        }
      }, timeoutMs);

      closeFn(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }

  async function startServer(startOptions = {}) {
    if (started) {
      const httpAddress = server.address();
      return {
        port: httpAddress?.port || config.port,
        httpsPort: httpsServer?.address()?.port || null,
      };
    }

    const port = startOptions.port ?? config.port;
    const desiredHttpsPort = startOptions.httpsPort ?? httpsPort;

    await db.initializeDatabase();
    if (!socketHandlersReady) {
      setupSocketHandlers(io);
      socketHandlersReady = true;
    }

    await new Promise((resolve) => server.listen(port, resolve));
    if (httpsServer) {
      await new Promise((resolve) => httpsServer.listen(desiredHttpsPort, resolve));
    }

    started = true;
    logger.info('Server started', {
      port: server.address()?.port,
      httpsPort: httpsServer?.address()?.port || null,
      env: config.env
    });

    return {
      port: server.address()?.port,
      httpsPort: httpsServer?.address()?.port || null,
    };
  }

  async function stopServer() {
    if (!started) return;
    try {
      await closeWithTimeout((done) => io.close(done));
      if (server.listening) {
        await closeWithTimeout((done) => server.close(done));
      }
      if (httpsServer && httpsServer.listening) {
        await closeWithTimeout((done) => httpsServer.close(done));
      }
    } finally {
      db.close();
      started = false;
    }
  }

  return {
    app,
    io,
    server,
    httpsServer,
    startServer,
    stopServer,
  };
}

module.exports = {
  createApp,
  detectLocalIP,
};
