/**
 * Room Socket Handler
 * Handles real-time room events
 */

const crypto = require('crypto');
const db = require('../../database/db');
const logger = require('../../utils/logger');
const {
  mapRoomMessageRow,
  getRoomMemberSnapshot,
} = require('../../services/socketDataService');

function createRoomHandler(io, socket, state) {
  const { users, usernames, rooms, joinRequests, socketToRooms } = state;

  /**
   * Generate secure room code
   */
  function generateRoomCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  /**
   * Create room
   */
  socket.on('create-room', () => {
    const user = users.get(socket.id);
    if (!user) {
      socket.emit('error', { message: 'Not registered' });
      return;
    }

    const roomId = `room_${state.roomCounter++}_${Date.now()}`;
    const roomCode = generateRoomCode();

    // Determine room type based on user authentication
    const roomType = user.id ? 'authenticated' : 'legacy';

    const room = {
      owner: user.username,
      ownerId: user.id,
      ownerSocketId: socket.id,
      code: roomCode,
      roomType: roomType,
      members: new Map([[user.username, user.publicKey]]),
      encryptedMessages: [],
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socketToRooms.get(socket.id).add(roomId);

    // Persist to database with room type
    db.createRoom(roomId, roomCode, user.id, user.username, roomType);

    socket.emit('room-created', { roomId, roomCode, roomType });
    logger.info('Room created', { roomId, roomCode, owner: user.username, roomType });
  });

  /**
   * Request to join room
   */
  socket.on('request-join', ({ roomCode }) => {
    const user = users.get(socket.id);
    
    logger.debug('Join request received', { roomCode, socketId: socket.id });

    if (!user) {
      socket.emit('error', { message: 'Not registered' });
      return;
    }

    // Look up room from DATABASE (not in-memory) for persistence
    const dbRoom = db.getRoomByCode(roomCode);
    logger.debug('Room lookup result', { roomCode, found: !!dbRoom, owner: dbRoom?.owner_username });

    if (!dbRoom) {
      socket.emit('error', { message: 'Room not found' });
      logger.warn('Room not found for join request', { roomCode });
      return;
    }

    // Check if already a member (via database)
    if (db.isRoomMember(dbRoom.room_id, user.username)) {
      socket.emit('error', { message: 'Already in room' });
      return;
    }

    // SECURITY: Enforce room type restrictions
    const userType = user.id ? 'authenticated' : 'legacy';
    const roomType = dbRoom.room_type || 'legacy'; // Default to legacy for old rooms

    if (userType !== roomType) {
      const errorMsg = userType === 'authenticated'
        ? 'Authenticated users cannot join legacy rooms. Please create your own room.'
        : 'This room requires authentication. Please sign up or log in first.';
      socket.emit('error', { message: errorMsg });
      logger.warn('Room type mismatch', {
        username: user.username,
        userType,
        roomType,
        roomCode
      });
      return;
    }

    const requestId = `req_${state.requestCounter++}`;
    joinRequests.set(requestId, {
      username: user.username,
      userId: user.id,
      publicKey: user.publicKey,
      roomId: dbRoom.room_id,
      roomCode: dbRoom.room_code,
      socketId: socket.id,
    });

    // Look up owner's current socket by username (not stale stored ID)
    const ownerSocketId = state.userToSocket.get(dbRoom.owner_username);
    logger.debug('Owner socket lookup', { owner: dbRoom.owner_username, online: !!ownerSocketId });

    logger.info('Join request received', {
      username: user.username,
      roomCode,
      roomId: dbRoom.room_id,
      roomOwner: dbRoom.owner_username,
      ownerOnline: !!ownerSocketId
    });

    if (ownerSocketId) {
      io.to(ownerSocketId).emit('join-request', {
        requestId,
        username: user.username,
        publicKey: user.publicKey,
        roomId: dbRoom.room_id,
      });
      logger.debug('Join request sent to owner', { ownerSocketId });
    } else {
      // Owner not online
      logger.warn('Join request failed - owner offline', { roomCode, owner: dbRoom.owner_username });
      socket.emit('error', { message: 'Room owner is not online' });
      joinRequests.delete(requestId);
    }
  });

  /**
   * Approve join request
   */
  socket.on('approve-join', ({ requestId }) => {
    const request = joinRequests.get(requestId);
    if (!request) return;

    // Verify the approver is the room owner (via database)
    const user = users.get(socket.id);
    if (!user) return;

    const dbRoom = db.getRoomById(request.roomId);
    if (!dbRoom || dbRoom.owner_username !== user.username) {
      socket.emit('error', { message: 'Not authorized to approve' });
      return;
    }

    // Persist membership to database
    db.addRoomMember(request.roomId, request.userId, request.username);

    // Get the requester's socket
    const requesterSocket = io.sockets.sockets.get(request.socketId);
    if (requesterSocket) {
      requesterSocket.join(request.roomId);
      socketToRooms.get(request.socketId)?.add(request.roomId);

      const { members: memberList, memberKeys } = getRoomMemberSnapshot(request.roomId);

      requesterSocket.emit('join-approved', {
        roomId: request.roomId,
        roomCode: request.roomCode || dbRoom.room_code,
        roomType: dbRoom.room_type || 'legacy',
        memberKeys,
      });

      socket.to(request.roomId).emit('member-joined', {
        username: request.username,
        publicKey: request.publicKey,
      });

      io.to(request.roomId).emit('members-update', {
        members: memberList,
        memberKeys,
      });

      logger.info('Join approved', { username: request.username, roomId: request.roomId });
    }

    joinRequests.delete(requestId);
  });

  /**
   * Deny join request
   */
  socket.on('deny-join', ({ requestId }) => {
    const request = joinRequests.get(requestId);
    if (!request) return;

    // Verify the denier is the room owner (via database)
    const user = users.get(socket.id);
    if (!user) return;

    const dbRoom = db.getRoomById(request.roomId);
    if (!dbRoom || dbRoom.owner_username !== user.username) return;

    const requesterSocket = io.sockets.sockets.get(request.socketId);
    if (requesterSocket) {
      requesterSocket.emit('join-denied');
    }

    joinRequests.delete(requestId);
    logger.debug('Join denied', { username: request.username });
  });

  /**
   * Join existing room (reconnection)
   */
  socket.on('join-room', ({ roomId }) => {
    const user = users.get(socket.id);
    if (!user) {
      socket.emit('error', { message: 'Not registered' });
      return;
    }

    // Check room exists in database
    const dbRoom = db.getRoomById(roomId);
    if (!dbRoom) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Check membership in database
    if (!db.isRoomMember(roomId, user.username)) {
      socket.emit('error', { message: 'Not a member' });
      return;
    }

    // SECURITY: Verify room type still matches user type (prevent type switching)
    const userType = user.id ? 'authenticated' : 'legacy';
    const roomType = dbRoom.room_type || 'legacy';

    if (userType !== roomType) {
      socket.emit('error', { message: 'Room type access denied' });
      logger.warn('Room type mismatch on rejoin', {
        username: user.username,
        userType,
        roomType,
        roomId
      });
      return;
    }

    socket.join(roomId);
    socketToRooms.get(socket.id)?.add(roomId);

    const { members: memberList, memberKeys } = getRoomMemberSnapshot(roomId);

    // Get messages from database
    const dbMessages = db.getRoomMessages(roomId);
    logger.debug('Loading room messages', { roomId, count: dbMessages.length });
    
    const encryptedMessages = dbMessages.map(mapRoomMessageRow);

    socket.emit('room-data', {
      members: memberList,
      memberKeys,
      encryptedMessages,
    });

    logger.debug('User joined room', { username: user.username, roomId });
  });

  /**
   * Leave room
   */
  socket.on('leave-room', ({ roomId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    // Check room exists
    const dbRoom = db.getRoomById(roomId);
    if (!dbRoom) return;

    socket.leave(roomId);
    socketToRooms.get(socket.id)?.delete(roomId);

    // Remove from database
    db.removeRoomMember(roomId, user.username);

    // Notify others
    io.to(roomId).emit('member-left', { username: user.username });

    const { members: memberList, memberKeys } = getRoomMemberSnapshot(roomId);

    io.to(roomId).emit('members-update', {
      members: memberList,
      memberKeys,
    });

    // Delete room if owner leaves
    if (dbRoom.owner_username === user.username) {
      db.deleteRoom(roomId);
      io.to(roomId).emit('room-closed');
      logger.info('Room closed', { roomId });
    }

    logger.info('User left room', { username: user.username, roomId });
  });
}

module.exports = createRoomHandler;
