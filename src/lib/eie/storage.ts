import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type StorageConfig = {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function getStorageConfig(): StorageConfig | null {
  const bucket = process.env.EIE_STORAGE_BUCKET;
  const endpoint = process.env.EIE_STORAGE_ENDPOINT;
  const accessKeyId = process.env.EIE_STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.EIE_STORAGE_SECRET_KEY;

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return { bucket, endpoint, accessKeyId, secretAccessKey };
}

function createClient(config: StorageConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function isStorageConfigured(): boolean {
  return getStorageConfig() !== null;
}

export function assertFileKeyOwnedByUser(fileKey: string, userId: string): void {
  const prefix = `eie/uploads/${userId}/`;
  if (!fileKey.startsWith(prefix)) {
    throw new Error("File key is not owned by the current admin");
  }
}

export async function createPresignedUploadUrl(
  fileKey: string,
  mimeType: string,
  expiresIn = 900
): Promise<string> {
  const config = getStorageConfig();
  if (!config) {
    throw new Error("Storage is not configured");
  }

  const client = createClient(config);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: fileKey,
    ContentType: mimeType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function storedObjectExists(fileKey: string): Promise<boolean> {
  const config = getStorageConfig();
  if (!config) return false;

  const client = createClient(config);
  try {
    await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: fileKey }));
    return true;
  } catch {
    return false;
  }
}

export async function fetchStoredObject(fileKey: string): Promise<Buffer> {
  const config = getStorageConfig();
  if (!config) {
    throw new Error("Storage is not configured");
  }

  const client = createClient(config);
  const response = await client.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: fileKey })
  );

  if (!response.Body) {
    throw new Error("Stored file is empty");
  }

  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}
