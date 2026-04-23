/**
 * Carga y valida las variables de entorno del proceso.
 *
 * Se usa junto a `@nestjs/config` como factoría (`load: [configuration]`).
 * Cualquier variable nueva debe agregarse aquí y también al `.env.example`.
 */
export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  mongo: {
    uri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/teg_telemedicina',
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'change_me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    resetSecret: process.env.JWT_RESET_SECRET ?? 'change_me_reset',
    resetExpiresIn: process.env.JWT_RESET_EXPIRES_IN ?? '24h',
  },

  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS ?? '3', 10),
  },

  mail: {
    host: process.env.MAIL_HOST ?? 'localhost',
    port: parseInt(process.env.MAIL_PORT ?? '1025', 10),
    user: process.env.MAIL_USER ?? '',
    pass: process.env.MAIL_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'no-reply@telemedicina.local',
    webResetUrl: process.env.WEB_RESET_URL ?? 'http://localhost:3001/reset-password',
  },

  files: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE ?? '1048576', 10),
    allowedMime: ['application/pdf', 'image/jpeg', 'image/png'] as const,
    allowedExt: ['.pdf', '.jpg', '.jpeg', '.png'] as const,
  },

  webrtc: {
    stunUrl: process.env.STUN_URL ?? 'stun:stun.l.google.com:19302',
    turnUrl: process.env.TURN_URL ?? '',
    turnUsername: process.env.TURN_USERNAME ?? '',
    turnCredential: process.env.TURN_CREDENTIAL ?? '',
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL ?? '',
    adminPassword: process.env.SEED_ADMIN_PASSWORD ?? '',
  },
});
