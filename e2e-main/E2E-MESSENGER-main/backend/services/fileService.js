/**
 * File Upload Service
 * Handles file upload, validation, and storage with encryption support
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const config = require('../config');
const db = require('../database/db');
const logger = require('../utils/logger');
const urlSigner = require('../utils/urlSigner');
const { ValidationError, NotFoundError } = require('../utils/errors');

class FileService {
  constructor() {
    // Ensure upload directory exists
    if (!fs.existsSync(config.upload.directory)) {
      fs.mkdirSync(config.upload.directory, { recursive: true });
    }

    // Configure multer storage
    this.storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, config.upload.directory);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      },
    });

    // Configure multer upload
    this.upload = multer({
      storage: this.storage,
      limits: {
        fileSize: config.upload.maxFileSize,
      },
      fileFilter: (req, file, cb) => {
        this.validateFile(file, req, cb);
      },
    });
  }

  /**
   * Validate file type
   * Allow encrypted files (application/octet-stream) to pass through
   */
  validateFile(file, req, cb) {
    // If it's an encrypted file, allow it
    if (req.body && req.body.encrypted === 'true') {
      return cb(null, true);
    }

    const extname = config.upload.allowedExtensions.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = config.upload.allowedMimeTypes.includes(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }

    // Also allow encrypted file extension
    if (file.originalname.endsWith('.enc')) {
      return cb(null, true);
    }

    cb(new ValidationError(`Invalid file type. Allowed: ${config.upload.allowedExtensions}`));
  }

  validateEncryptedUploadPayload(payload, uploadedFileSize) {
    const originalName = (payload.originalName || '').trim();
    const originalType = (payload.originalType || '').trim();
    const originalSize = parseInt(payload.originalSize, 10);

    if (!originalName || originalName.length > 255) {
      throw new ValidationError('Invalid encrypted file name');
    }
    if (!originalType || !config.upload.allowedMimeTypes.includes(originalType)) {
      throw new ValidationError('Invalid encrypted original MIME type');
    }
    if (!Number.isFinite(originalSize) || originalSize <= 0 || originalSize > config.upload.maxFileSize) {
      throw new ValidationError('Invalid encrypted original file size');
    }
    if (uploadedFileSize <= 0 || uploadedFileSize > config.upload.maxFileSize) {
      throw new ValidationError('Invalid uploaded encrypted payload size');
    }
  }

  validateUploadedFileContent(file) {
    const absolutePath = path.resolve(config.upload.directory, file.filename);
    const header = Buffer.alloc(16);
    const fd = fs.openSync(absolutePath, 'r');
    try {
      fs.readSync(fd, header, 0, header.length, 0);
    } finally {
      fs.closeSync(fd);
    }

    const isJpeg = header[0] === 0xff && header[1] === 0xd8;
    const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
    const isGif = header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38;
    const isWebp = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46
      && header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;
    const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;

    if (file.mimetype === 'image/jpeg' && !isJpeg) {
      throw new ValidationError('JPEG signature mismatch');
    }
    if (file.mimetype === 'image/png' && !isPng) {
      throw new ValidationError('PNG signature mismatch');
    }
    if (file.mimetype === 'image/gif' && !isGif) {
      throw new ValidationError('GIF signature mismatch');
    }
    if (file.mimetype === 'image/webp' && !isWebp) {
      throw new ValidationError('WEBP signature mismatch');
    }
    if (file.mimetype === 'application/pdf' && !isPdf) {
      throw new ValidationError('PDF signature mismatch');
    }
  }

  /**
   * Get multer middleware for single file upload
   */
  getUploadMiddleware() {
    return this.upload.single('file');
  }

  /**
   * Save file metadata to database (with encryption support)
   */
  saveFileMetadata(roomId, userId, username, file, encryptionInfo = {}) {
    const { encrypted, iv, metadata, originalName, originalType, originalSize } = encryptionInfo;

    const attachment = db.createAttachment(
      roomId,
      userId,
      username,
      encrypted ? originalName : file.originalname,
      file.filename,
      encrypted ? 'application/octet-stream' : file.mimetype,
      file.size,
      {
        encrypted: encrypted || false,
        iv: iv || null,
        metadata: metadata || null,
        originalName: originalName || null,
        originalType: originalType || null,
        originalSize: originalSize || null,
      }
    );

    logger.info('File uploaded', { 
      attachmentId: attachment.id, 
      roomId, 
      filename: encrypted ? originalName : file.originalname,
      encrypted: encrypted || false,
    });

    return {
      id: attachment.id,
      filename: encrypted ? originalName : attachment.filename,
      url: urlSigner.sign(`/api/files/${attachment.id}`),
      mimetype: encrypted ? originalType : attachment.mimetype,
      size: encrypted ? originalSize : attachment.size,
      encrypted: encrypted || false,
      iv: iv || null,
      metadata: metadata || null,
    };
  }

  /**
   * Get attachment by ID
   */
  getAttachment(id) {
    const attachment = db.getAttachment(id);

    if (!attachment) {
      throw new NotFoundError('Attachment');
    }

    return attachment;
  }

  /**
   * Get all attachments for a room
   */
  getRoomAttachments(roomId) {
    return db.getRoomAttachments(roomId);
  }

  getRoomAttachmentsPage(roomId, page, pageSize) {
    return db.getRoomAttachmentsPage(roomId, page, pageSize);
  }

  createSignedDownloadUrl(attachmentId) {
    return urlSigner.sign(`/api/files/${attachmentId}`);
  }

  /**
   * Delete attachment file from disk
   */
  deleteFile(filepath) {
    const fullPath = path.join(config.upload.directory, filepath);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.debug('File deleted', { filepath });
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Check if file is an image
   */
  isImage(mimetype) {
    return mimetype && mimetype.startsWith('image/');
  }
}

module.exports = new FileService();
