export default () => ({
  MAILER_HOST: process.env.MAILER_HOST || '',
  MAILER_PORT: process.env.MAILER_PORT || 465,
  MAILER_USER: process.env.MAILER_USER || '',
  MAILER_PASSWORD: process.env.MAILER_PASSWORD || '',
  MAILER_FROM: process.env.MAILER_FROM || '',
  MAILER_SECURE: process.env.MAILER_SECURE === 'true', // Convert to boolean
  MAILER_TLS_REJECT_UNAUTHORIZED:
    process.env.MAILER_TLS_REJECT_UNAUTHORIZED === 'true', // Convert to boolean
});
