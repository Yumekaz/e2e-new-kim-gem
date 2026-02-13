const request = require('supertest');

describe('Authentication API', () => {
  const API_URL = () => global.__TEST_API_URL__;
  let accessToken;
  let refreshToken;
  const testUser = {
    email: `test${Date.now()}@example.com`,
    username: `testuser${Date.now()}`,
    password: 'TestPassword123',
  };

  it('registers a new user', async () => {
    const res = await request(API_URL())
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user).not.toHaveProperty('password_hash');

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('rejects invalid registration payloads', async () => {
    await request(API_URL())
      .post('/api/auth/register')
      .send({ email: 'invalid-email', username: 'testuser', password: 'TestPassword123' })
      .expect(400);

    await request(API_URL())
      .post('/api/auth/register')
      .send({ email: 'test@example.com', username: 'ab', password: 'short' })
      .expect(400);
  });

  it('logs in with valid credentials', async () => {
    const res = await request(API_URL())
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('user');
  });

  it('rejects invalid login credentials', async () => {
    await request(API_URL())
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpassword' })
      .expect(401);

    await request(API_URL())
      .post('/api/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'TestPassword123' })
      .expect(401);
  });

  it('refreshes access token and rotates refresh token', async () => {
    const res = await request(API_URL())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.refreshToken).not.toBe(refreshToken);

    refreshToken = res.body.refreshToken;
  });

  it('rejects invalid refresh token', async () => {
    await request(API_URL())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid-token' })
      .expect(401);
  });

  it('returns current user profile for valid token', async () => {
    const res = await request(API_URL())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('user');
    expect(res.body.user.username).toBe(testUser.username);
  });

  it('rejects profile request without or with invalid token', async () => {
    await request(API_URL()).get('/api/auth/me').expect(401);
    await request(API_URL())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('supports logout-all', async () => {
    await request(API_URL())
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });
});

describe('Rate Limiting', () => {
  const API_URL = () => global.__TEST_API_URL__;

  it('adds rate limit headers to auth endpoints', async () => {
    const res = await request(API_URL())
      .post('/api/auth/login')
      .send({ email: 'x@example.com', password: 'wrongpassword' });

    expect(res.headers['x-ratelimit-limit']).toBeDefined();
  });
});

