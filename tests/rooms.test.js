const request = require('supertest');

const API_URL = () => global.__TEST_API_URL__;

describe('Room API', () => {
  let ownerToken;
  let ownerUsername;
  let roomId;
  let roomCode;

  beforeAll(async () => {
    const ts = Date.now();
    const res = await request(API_URL())
      .post('/api/auth/register')
      .send({
        email: `room_owner_${ts}@example.com`,
        username: `roomowner${ts}`.slice(0, 20),
        password: 'TestPassword123',
      })
      .expect(201);

    ownerToken = res.body.accessToken;
    ownerUsername = res.body.user.username;
  });

  it('creates a room for authenticated user', async () => {
    const res = await request(API_URL())
      .post('/api/rooms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    expect(res.body.room.roomCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.body.room.isOwner).toBe(true);

    roomId = res.body.room.roomId;
    roomCode = res.body.room.roomCode;
  });

  it('rejects room creation without authentication', async () => {
    await request(API_URL()).post('/api/rooms').expect(401);
  });

  it('returns room by code for owner', async () => {
    const res = await request(API_URL())
      .get(`/api/rooms/code/${roomCode}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.room.roomCode).toBe(roomCode);
  });

  it('returns my-rooms list', async () => {
    const res = await request(API_URL())
      .get('/api/rooms/my-rooms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Array.isArray(res.body.rooms)).toBe(true);
    expect(res.body.rooms.some((r) => r.roomCode === roomCode)).toBe(true);
  });

  it('enforces room membership for members endpoint', async () => {
    const outsiderRes = await request(API_URL())
      .post('/api/auth/register')
      .send({
        email: `room_outsider_${Date.now()}@example.com`,
        username: `outsider${Date.now()}`.slice(0, 20),
        password: 'TestPassword123',
      })
      .expect(201);

    await request(API_URL())
      .get(`/api/rooms/${roomId}/members`)
      .set('Authorization', `Bearer ${outsiderRes.body.accessToken}`)
      .expect(403);
  });

  it('returns messages endpoint with pagination keys', async () => {
    const res = await request(API_URL())
      .get(`/api/rooms/${roomId}/messages?limit=10`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });

  it('prevents non-owner room deletion', async () => {
    const nonOwnerRes = await request(API_URL())
      .post('/api/auth/register')
      .send({
        email: `room_nonowner_${Date.now()}@example.com`,
        username: `nonowner${Date.now()}`.slice(0, 20),
        password: 'TestPassword123',
      })
      .expect(201);

    const status = await request(API_URL())
      .delete(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${nonOwnerRes.body.accessToken}`);

    expect([403, 404]).toContain(status.status);
  });

  it('deletes room when owner requests deletion', async () => {
    await request(API_URL())
      .delete(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});

