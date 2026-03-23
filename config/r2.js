// config/r2.js
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const bucket = process.env.R2_BUCKET;

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function uploadToR2({ buffer, key, contentType }) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  return {
    bucket,
    key,
  };
}

async function getObjectSignedUrl(key, expiresIn = 900) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

module.exports = {
  r2Client,
  bucket,
  uploadToR2,
  getObjectSignedUrl,
};