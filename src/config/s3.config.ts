export default () => ({
  S3_REGION: process.env.S3_REGION || '',
  S3_BUCKET: process.env.S3_BUCKET || '',
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || '',
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || '',
  S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL || '',
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE || false,
});
