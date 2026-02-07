export const jwtConfig = {
  secret: process.env.JWT_SECRET as string,
  expiresIn: process.env.JWT_EXPIRES_IN || '30m',
  algorithm: 'HS256' as const,
  issuer: 'gtower-api',
  audience: 'gtower-client',
};
