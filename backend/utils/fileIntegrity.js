/**
 * File Integrity Utility
 * Verifies file integrity between database records and filesystem
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const logger = require('./logger');

class FileIntegrity {
  /**
   * Calculate SHA-256 hash of a file
   * @param {string} filepath - Path to file
   * @returns {Promise<string>} File hash
   */
  async calculateHash(filepath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filepath);
      
      stream.on('error', reject);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  /**
   * Verify file exists and matches stored metadata
   * @param {Object} attachment - Attachment record from database
   * @returns {Promise<Object>} Verification result
   */
  async verifyFile(attachment) {
    const fullPath = path.join(config.upload.directory, attachment.filepath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      logger.error('File integrity check failed - file missing', {
        attachmentId: attachment.id,
        filepath: attachment.filepath,
      });
      return {
        valid: false,
        error: 'File not found on filesystem',
        missing: true,
      };
    }

    // Check file size matches
    const stats = fs.statSync(fullPath);
    if (stats.size !== attachment.size) {
      logger.error('File integrity check failed - size mismatch', {
        attachmentId: attachment.id,
        expected: attachment.size,
        actual: stats.size,
      });
      return {
        valid: false,
        error: 'File size mismatch',
        sizeMismatch: true,
      };
    }

    return {
      valid: true,
      size: stats.size,
    };
  }

  /**
   * Clean up orphaned files (files on disk not in DB)
   * @returns {Promise<number>} Number of files cleaned up
   */
  async cleanupOrphanedFiles() {
    const db = require('../database/db');
    const files = fs.readdirSync(config.upload.directory);
    const dbFiles = db.getAllAttachmentFilepaths();
    const dbFileSet = new Set(dbFiles);
    
    let cleaned = 0;
    
    for (const file of files) {
      if (!dbFileSet.has(file)) {
        const fullPath = path.join(config.upload.directory, file);
        fs.unlinkSync(fullPath);
        logger.info('Cleaned up orphaned file', { filepath: file });
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Clean up missing file records (DB records without files)
   * @returns {Promise<number>} Number of records cleaned up
   */
  async cleanupMissingFiles() {
    const db = require('../database/db');
    const attachments = db.getAllAttachments();
    let cleaned = 0;
    
    for (const attachment of attachments) {
      const fullPath = path.join(config.upload.directory, attachment.filepath);
      if (!fs.existsSync(fullPath)) {
        db.deleteAttachment(attachment.id);
        logger.info('Cleaned up missing file record', { 
          attachmentId: attachment.id,
          filepath: attachment.filepath,
        });
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

module.exports = new FileIntegrity();
