import dotenv from 'dotenv';
dotenv.config();

const requiredEnv = ['JWT_SECRET', 'DATABASE_URL', 'CORS_ORIGINS'] as const;
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  if (process.env.NODE_ENV === 'production') {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  } else {
    console.warn(`WARNING: Missing environment variables: ${missing.join(', ')} — set them before deploying to production`);
  }
}

import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`G-Tower Backend running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
});
