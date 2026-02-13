const fs = require('fs');
const path = require('path');

const TEST_DB_PATH = path.join(__dirname, '..', 'messenger.test.db');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'jest-local-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'jest-local-refresh-secret';
process.env.URL_SIGNING_SECRET = process.env.URL_SIGNING_SECRET || 'jest-local-url-secret';
process.env.DATABASE_PATH = TEST_DB_PATH;

const { createApp } = require('../backend/app');

let runtime = null;

beforeAll(async () => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  runtime = createApp({ enableHttps: false });
  const ports = await runtime.startServer({ port: 0 });

  global.__TEST_API_URL__ = `http://127.0.0.1:${ports.port}`;
}, 30000);

afterAll(async () => {
  if (runtime) {
    await runtime.stopServer();
  }

  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}, 30000);

