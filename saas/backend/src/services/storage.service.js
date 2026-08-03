import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

let s3Client = null;

function getS3Client() {
  if (!env.s3Bucket || !env.s3PublicBaseUrl) {
    return null;
  }

  if (!s3Client) {
    s3Client = new S3Client({ region: env.s3Region });
  }

  return s3Client;
}

export function isS3Configured() {
  return getS3Client() !== null;
}

// One save function, two real backends — chosen automatically by whether
// S3_BUCKET/S3_PUBLIC_BASE_URL are set (see .env.example), not by a
// runtime flag someone has to remember to flip. Local disk is a completely
// valid choice for development and for images that only need to reach
// this server's own dashboard/Claude API calls (which read local files
// directly, see ai.service.js's buildImageSource); it stops being valid
// the moment an image needs to be forwarded to a real Facebook Messenger
// recipient, which needs a publicly fetchable URL — S3 is what makes that
// path work in production.
export async function saveUpload(buffer, originalName, mimeType) {
  const ext = path.extname(originalName).slice(0, 10);
  const key = `${crypto.randomUUID()}${ext}`;
  const client = getS3Client();

  if (client) {
    await client.send(new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType
    }));

    return { url: `${env.s3PublicBaseUrl.replace(/\/$/, '')}/${key}`, isPublic: true };
  }

  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, key), buffer);

  return { url: `/uploads/${key}`, isPublic: false };
}
