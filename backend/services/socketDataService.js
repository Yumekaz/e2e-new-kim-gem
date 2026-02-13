/**
 * Socket Data Service
 * Centralizes socket payload shaping to reduce duplication across handlers/controllers.
 */

const db = require('../database/db');
const urlSigner = require('../utils/urlSigner');

const IMAGE_MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

function inferMimeFromName(filename = '') {
  const ext = String(filename).split('.').pop()?.toLowerCase();
  return ext ? IMAGE_MIME_BY_EXT[ext] : undefined;
}

function resolveAttachmentMime(attachmentRow) {
  const nameToCheck = attachmentRow.original_name || attachmentRow.filename;
  return attachmentRow.original_type || inferMimeFromName(nameToCheck) || attachmentRow.mimetype;
}

function mapAttachment(attachmentRow) {
  if (!attachmentRow) {
    return null;
  }

  return {
    id: attachmentRow.id || attachmentRow.attachment_id,
    filename: attachmentRow.filename,
    url: urlSigner.sign(`/api/files/${attachmentRow.id || attachmentRow.attachment_id}`),
    mimetype: resolveAttachmentMime(attachmentRow),
    size: attachmentRow.size,
    encrypted: !!attachmentRow.encrypted,
    iv: attachmentRow.attachment_iv || attachmentRow.iv || null,
    metadata: attachmentRow.metadata || null,
  };
}

function mapRoomMessageRow(messageRow) {
  const createdAt = messageRow.created_at;
  const timestamp = typeof createdAt === 'string'
    ? new Date(createdAt.replace(' ', 'T')).getTime()
    : new Date(createdAt).getTime();

  return {
    id: messageRow.message_id,
    senderUsername: messageRow.sender_username,
    encryptedData: messageRow.encrypted_data,
    iv: messageRow.iv,
    timestamp,
    attachment: messageRow.attachment_id ? mapAttachment(messageRow) : undefined,
  };
}

function getRoomMemberSnapshot(roomId) {
  const members = db.getRoomMembers(roomId);
  const memberKeys = {};
  const usernames = [];

  for (const member of members) {
    usernames.push(member.username);
    const memberUser = db.getUserByUsername(member.username);
    if (memberUser?.public_key) {
      memberKeys[member.username] = memberUser.public_key;
    }
  }

  return {
    members: usernames,
    memberKeys,
  };
}

module.exports = {
  mapAttachment,
  mapRoomMessageRow,
  getRoomMemberSnapshot,
};

