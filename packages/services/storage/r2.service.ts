import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID || "mock-account";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || "mock-access-key";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "mock-secret-key";

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function getR2BucketName(): string {
  return process.env.R2_BUCKET_NAME || "listinglift-uploads";
}

export function getPublicUrlForS3Key(s3Key: string): string {
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (publicBase && !publicBase.includes("YOUR_R2_PUBLIC_URL")) {
    return `${publicBase}/${s3Key}`;
  }
  return `https://${getR2BucketName()}.r2.cloudflarestorage.com/${s3Key}`;
}

export async function getPresignedUploadUrl(
  s3Key: string,
  mimeType: string,
  expiresInSeconds: number = 300
): Promise<{ uploadUrl: string; s3Key: string; publicUrl: string }> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });

  return {
    uploadUrl,
    s3Key,
    publicUrl: getPublicUrlForS3Key(s3Key),
  };
}

export async function getPresignedDownloadUrl(
  s3Key: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  });

  return await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });
}

export async function uploadBufferToR2(
  s3Key: string,
  buffer: Buffer,
  mimeType: string = "image/webp"
): Promise<{ s3Key: string; publicUrl: string }> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: buffer,
    ContentType: mimeType,
  });

  await client.send(command);

  return {
    s3Key,
    publicUrl: getPublicUrlForS3Key(s3Key),
  };
}

export async function fetchBufferFromR2(s3Key: string): Promise<Buffer> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  });

  const response = await client.send(command);
  const stream = response.Body;

  if (!stream) {
    throw new Error(`Empty body returned for S3 key: ${s3Key}`);
  }

  const byteArray = await stream.transformToByteArray();
  return Buffer.from(byteArray);
}

export async function deleteObjectFromR2(s3Key: string): Promise<void> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  });

  await client.send(command);
}
