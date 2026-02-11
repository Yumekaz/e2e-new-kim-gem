/**
 * File Controller
 * Handles file upload requests with encryption support
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const fileService = require('../services/fileService');
const roomService = require('../services/roomService');
const urlSigner = require('../utils/urlSigner');
const logger = require('../utils/logger');
const { ValidationError, AuthorizationError, NotFoundError } = require('../utils/errors');

class FileController {
  /**
   * POST /api/files/upload
   * Upload a file (plain or encrypted)
   */
  async upload(req, res, next) {
    try {
      await new Promise((resolve, reject) => {
        fileService.getUploadMiddleware()(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (!req.file) {
        throw new ValidationError('No file uploaded');
      }

      const { roomId, encrypted, iv, metadata, originalName, originalType, originalSize } = req.body;

      if (!roomId) {
        throw new ValidationError('Room ID is required');
      }

      if (!roomService.isMember(roomId, req.user.username)) {
        throw new AuthorizationError('Not a room member');
      }
      if (encrypted === 'true') {
        fileService.validateEncryptedUploadPayload(req.body, req.file.size);
      } else {
        fileService.validateUploadedFileContent(req.file);
      }

      const attachment = fileService.saveFileMetadata(
        roomId,
        req.user.userId,
        req.user.username,
        req.file,
        {
          encrypted: encrypted === 'true',
          iv: iv || null,
          metadata: metadata || null,
          originalName: originalName || null,
          originalType: originalType || null,
          originalSize: originalSize ? parseInt(originalSize, 10) : null,
        }
      );

      res.status(201).json({
        message: 'File uploaded successfully',
        attachment,
      });
    } catch (error) {
      if (req.file) {
        fileService.deleteFile(req.file.filename);
      }
      next(error);
    }
  }

  /**
   * GET /api/files/:id
   * Get file metadata
   */
  async getFile(req, res, next) {
    try {
      const { id } = req.params;
      const { sig, exp } = req.query;
      const attachment = fileService.getAttachment(parseInt(id, 10));
      const filePath = `/api/files/${attachment.id}`;

      // Verify user is a room member
      if (!roomService.isMember(attachment.room_id, req.user.username)) {
        throw new AuthorizationError('Not a room member');
      }

      if (!sig || !exp || !urlSigner.verify(filePath, String(sig), Number(exp))) {
        throw new AuthorizationError('Invalid or expired file URL signature');
      }

      // Serve the specific file
      const absolutePath = path.resolve(config.upload.directory, attachment.filepath);

      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        throw new NotFoundError('File not found on server');
      }

      // Set correct mimetype
      // If encrypted, sending as application/octet-stream is correct
      // If plain, use stored mimetype
      res.setHeader('Content-Type', attachment.mimetype);
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);

      const stream = fs.createReadStream(absolutePath);
      stream.on('error', (err) => {
        logger.error('File stream error', { error: err.message, attachmentId: attachment.id });
        if (!res.headersSent) res.status(500).json({ message: 'Error streaming file' });
      });
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/files/:id/url
   * Refresh a signed download URL
   */
  async getFileUrl(req, res, next) {
    try {
      const attachment = fileService.getAttachment(parseInt(req.params.id, 10));

      if (!roomService.isMember(attachment.room_id, req.user.username)) {
        throw new AuthorizationError('Not a room member');
      }

      res.json({
        attachment: {
          id: attachment.id,
          url: fileService.createSignedDownloadUrl(attachment.id),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/files/room/:roomId
   * Get all files in a room
   */
  async getRoomFiles(req, res, next) {
    try {
      const { roomId } = req.params;
      const page = Math.max(parseInt(req.query.page, 10) || config.pagination.defaultPage, 1);
      const rawPageSize = parseInt(req.query.pageSize || req.query.limit, 10) || config.pagination.defaultPageSize;
      const pageSize = Math.min(Math.max(rawPageSize, 1), config.pagination.maxPageSize);

      // Verify user is a room member
      if (!roomService.isMember(roomId, req.user.username)) {
        throw new AuthorizationError('Not a room member');
      }

      const { attachments, pagination } = fileService.getRoomAttachmentsPage(roomId, page, pageSize);

      res.json({
        attachments: attachments.map(a => ({
          id: a.id,
          filename: a.encrypted ? a.original_name : a.filename,
          url: urlSigner.sign(`/api/files/${a.id}`),
          mimetype: a.encrypted ? a.original_type : a.mimetype,
          size: a.encrypted ? a.original_size : a.size,
          uploadedBy: a.username,
          createdAt: a.created_at,
          isImage: a.encrypted ? fileService.isImage(a.original_type) : fileService.isImage(a.mimetype),
          encrypted: a.encrypted || false,
          iv: a.iv || null,
          metadata: a.metadata || null,
        })),
        pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FileController();
