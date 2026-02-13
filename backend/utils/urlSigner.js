/**
 * URL Signer Utility
 * Generates signed URLs for secure file downloads
 * Uses HMAC-SHA256 to sign URLs with expiration
 */

const crypto = require('crypto');
const config = require('../config');

// Secret key for signing - should be in config
const SIGNING_SECRET = config.security?.urlSigningSecret || process.env.URL_SIGNING_SECRET || 'fallback-secret-change-in-production';
const DEFAULT_EXPIRY = 3600; // 1 hour in seconds

class URLSigner {
  /**
   * Generate a signed URL
   * @param {string} path - URL path (e.g., '/api/files/123')
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {string} Signed URL with signature and expiration
   */
  sign(path, expiresIn = DEFAULT_EXPIRY) {
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const data = `${path}:${expires}`;
    const signature = crypto
      .createHmac('sha256', SIGNING_SECRET)
      .update(data)
      .digest('hex');
    
    return `${path}?sig=${signature}&exp=${expires}`;
  }

  /**
   * Verify a signed URL
   * @param {string} path - URL path without query string
   * @param {string} signature - Signature from query param
   * @param {number} expiration - Expiration timestamp from query param
   * @returns {boolean} Whether the signature is valid and not expired
   */
  verify(path, signature, expiration) {
    // Check if expired
    const now = Math.floor(Date.now() / 1000);
    if (now > parseInt(expiration, 10)) {
      return false;
    }

    // Verify signature
    const data = `${path}:${expiration}`;
    const expectedSignature = crypto
      .createHmac('sha256', SIGNING_SECRET)
      .update(data)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (e) {
      // Buffer length mismatch or other error
      return false;
    }
  }

  /**
   * Extract signature params from URL
   * @param {string} url - Full URL or query string
   * @returns {Object|null} Signature params or null if invalid
   */
  extractParams(url) {
    const urlObj = new URL(url, 'http://localhost');
    const signature = urlObj.searchParams.get('sig');
    const expiration = urlObj.searchParams.get('exp');
    
    if (!signature || !expiration) {
      return null;
    }

    return {
      path: urlObj.pathname,
      signature,
      expiration: parseInt(expiration, 10),
    };
  }
}

module.exports = new URLSigner();
