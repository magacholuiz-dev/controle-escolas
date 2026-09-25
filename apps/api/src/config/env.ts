// Environment, read once. Same variables as the legacy app so the droplet's .env keeps working.
const num = (v: string | undefined, fallback: number): number => Number(v) || fallback;

export const env = {
  port: num(process.env.PORT, 3200),
  host: process.env.LISTEN_HOST || '127.0.0.1',
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27019/controle-escolas',
  sessionTtlHours: num(process.env.SESSION_TTL_HOURS, 24 * 7),
  cookieSecure: process.env.COOKIE_SECURE === '1',
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  seedOwnerEmail: process.env.SEED_OWNER_EMAIL,
  seedOwnerPassword: process.env.SEED_OWNER_PASSWORD,
  maxBody: '1mb',
};
