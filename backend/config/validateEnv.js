/**
 * Environment Variable Validation
 * Ensures all required environment variables are set before server starts
 */

// Required environment variables
const REQUIRED_VARS = [
  { name: 'JWT_SECRET', description: 'Secret key for JWT token signing' },
  { name: 'JWT_REFRESH_SECRET', description: 'Secret key for JWT refresh tokens' },
];

// Optional environment variables with defaults
const OPTIONAL_VARS = [
  { name: 'NODE_ENV', default: 'development' },
  { name: 'PORT', default: '3001' },
  { name: 'URL_SIGNING_SECRET', default: null },
  { name: 'DB_PATH', default: './data/chat.db' },
  { name: 'UPLOAD_DIR', default: './uploads' },
  { name: 'MAX_FILE_SIZE', default: '10485760' }, // 10MB
];

/**
 * Validate environment variables
 * @throws {Error} If required variables are missing
 */
function validateEnv() {
  const missing = [];
  
  // Check required variables
  for (const { name, description } of REQUIRED_VARS) {
    if (!process.env[name]) {
      missing.push({ name, description });
    }
  }
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    for (const { name, description } of missing) {
      console.error(`  - ${name}: ${description}`);
    }
    throw new Error(`Missing ${missing.length} required environment variable(s)`);
  }
  
  // Set defaults for optional variables
  for (const { name, default: defaultValue } of OPTIONAL_VARS) {
    if (!process.env[name] && defaultValue !== null) {
      process.env[name] = defaultValue;
      if (process.env.NODE_ENV !== 'test') {
        console.log(`Using default for ${name}: ${defaultValue}`);
      }
    }
  }
  
  // Security warnings
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.URL_SIGNING_SECRET) {
      console.warn('URL_SIGNING_SECRET not set - using fallback (not recommended for production)');
    }
    
    if (process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
      console.error('WARNING: Using default JWT_SECRET in production!');
    }
  }
}

module.exports = { validateEnv, REQUIRED_VARS, OPTIONAL_VARS };
