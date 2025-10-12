export default () => ({
  S3_END_POINT: process.env.S3_END_POINT || '',
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || '',
  S3_SECRET_ACCESS_KEY_ID: process.env.S3_SECRET_ACCESS_KEY_ID || '',
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || '',
});
