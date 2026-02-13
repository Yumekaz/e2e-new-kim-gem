const request = require('supertest');
const { io } = require('socket.io-client');

const API_URL = () => global.__TEST_API_URL__;

function waitForEvent(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('Socket + API E2E', () => {
  let userA;
  let userB;
  let roomId;
  let roomCode;
  let socketA;
  let socketB;

  afterAll(() => {
    if (socketA) socketA.disconnect();
    if (socketB) socketB.disconnect();
  });

  it('registers two authenticated users', async () => {
    const ts = Date.now();
    const regA = await request(API_URL())
      .post('/api/auth/register')
      .send({
        email: `e2e_a_${ts}@example.com`,
        username: `e2eusera${ts}`.slice(0, 20),
        password: 'SecurePass123',
      })
      .expect(201);

    const regB = await request(API_URL())
      .post('/api/auth/register')
      .send({
        email: `e2e_b_${ts}@example.com`,
        username: `e2euserb${ts}`.slice(0, 20),
        password: 'SecurePass123',
      })
      .expect(201);

    userA = { token: regA.body.accessToken, username: regA.body.user.username };
    userB = { token: regB.body.accessToken, username: regB.body.user.username };
  });

  it('creates room for user A', async () => {
    const res = await request(API_URL())
      .post('/api/rooms')
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(201);

    roomId = res.body.room.roomId;
    roomCode = res.body.room.roomCode;
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('connects sockets and registers users', async () => {
    socketA = io(API_URL(), { autoConnect: false, auth: { token: userA.token } });
    socketB = io(API_URL(), { autoConnect: false, auth: { token: userB.token } });

    socketA.connect();
    socketB.connect();

    await Promise.all([
      waitForEvent(socketA, 'connect'),
      waitForEvent(socketB, 'connect'),
    ]);

    const aRegistered = waitForEvent(socketA, 'registered');
    const bRegistered = waitForEvent(socketB, 'registered');

    socketA.emit('register', { username: userA.username, publicKey: `pub-a-${Date.now()}` });
    socketB.emit('register', { username: userB.username, publicKey: `pub-b-${Date.now()}` });

    await Promise.all([aRegistered, bRegistered]);
  });

  it('requests join and owner approves', async () => {
    const joinRequest = waitForEvent(socketA, 'join-request');
    socketB.emit('request-join', { roomCode });

    const req = await joinRequest;
    expect(req).toHaveProperty('requestId');
    expect(req.username).toBe(userB.username);

    const approved = waitForEvent(socketB, 'join-approved');
    socketA.emit('approve-join', { requestId: req.requestId });
    const approval = await approved;

    expect(approval.roomId).toBe(roomId);
  });

  it('joins room and exchanges encrypted message event', async () => {
    const roomData = waitForEvent(socketA, 'room-data');
    socketA.emit('join-room', { roomId });
    const data = await roomData;
    expect(Array.isArray(data.members)).toBe(true);

    const incoming = waitForEvent(socketB, 'new-encrypted-message');
    socketA.emit('send-encrypted-message', {
      roomId,
      encryptedData: 'test-encrypted-data',
      iv: 'test-iv',
      senderUsername: userA.username,
    });
    const msg = await incoming;
    expect(msg.encryptedData).toBe('test-encrypted-data');
    expect(msg.senderUsername).toBe(userA.username);
  });
});

