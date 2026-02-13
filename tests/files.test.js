const request = require('supertest');
const path = require('path');
const fs = require('fs');

const API_URL = () => global.__TEST_API_URL__;

describe('File Upload API', () => {
  let accessToken;
  let roomId;
  let uploadedFileId;

  const testFilePath = path.join(__dirname, 'test-file.txt');
  const testImagePath = path.join(__dirname, 'test-image.png');

  beforeAll(async () => {
    fs.writeFileSync(testFilePath, 'This is a test file for upload testing.');
    const minimalPNG = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
      0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
      0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
      0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    fs.writeFileSync(testImagePath, minimalPNG);

    const regRes = await request(API_URL())
      .post('/api/auth/register')
      .send({
        email: `filetest${Date.now()}@example.com`,
        username: `fileuser${Date.now()}`.slice(0, 20),
        password: 'TestPassword123',
      })
      .expect(201);

    accessToken = regRes.body.accessToken;

    const roomRes = await request(API_URL())
      .post('/api/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    roomId = roomRes.body.room.roomId;
  });

  afterAll(() => {
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath);
  });

  it('uploads a text file', async () => {
    const res = await request(API_URL())
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('roomId', roomId)
      .attach('file', testFilePath)
      .expect(201);

    expect(res.body).toHaveProperty('attachment');
    expect(res.body.attachment).toHaveProperty('id');
    uploadedFileId = res.body.attachment.id;
  });

  it('uploads an image file', async () => {
    const res = await request(API_URL())
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('roomId', roomId)
      .attach('file', testImagePath)
      .expect(201);

    expect(res.body.attachment.mimetype).toBe('image/png');
  });

  it('rejects upload without auth token', async () => {
    await request(API_URL())
      .post('/api/files/upload')
      .field('roomId', roomId)
      .attach('file', testFilePath)
      .expect(401);
  });

  it('rejects invalid file type', async () => {
    const invalidFilePath = path.join(__dirname, 'test.exe');
    fs.writeFileSync(invalidFilePath, 'fake executable content');
    try {
      await request(API_URL())
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('roomId', roomId)
        .attach('file', invalidFilePath)
        .expect(400);
    } finally {
      if (fs.existsSync(invalidFilePath)) fs.unlinkSync(invalidFilePath);
    }
  });

  it('lists files in room for member', async () => {
    const res = await request(API_URL())
      .get(`/api/files/room/${roomId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body.attachments)).toBe(true);
    expect(res.body.attachments.some((a) => a.id === uploadedFileId)).toBe(true);
  });

  it('rejects file list for non-member', async () => {
    const outsider = await request(API_URL())
      .post('/api/auth/register')
      .send({
        email: `filenon${Date.now()}@example.com`,
        username: `filenon${Date.now()}`.slice(0, 20),
        password: 'TestPassword123',
      })
      .expect(201);

    await request(API_URL())
      .get(`/api/files/room/${roomId}`)
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .expect(403);
  });
});

