import "dotenv/config";
import { config } from "dotenv";
import {
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

config({ path: ".env.local", override: true });

const bucket = process.env.EIE_STORAGE_BUCKET;
const endpoint = process.env.EIE_STORAGE_ENDPOINT;
const accessKeyId = process.env.EIE_STORAGE_ACCESS_KEY;
const secretAccessKey = process.env.EIE_STORAGE_SECRET_KEY;

function missing() {
  return [
    !bucket && "EIE_STORAGE_BUCKET",
    !endpoint && "EIE_STORAGE_ENDPOINT",
    !accessKeyId && "EIE_STORAGE_ACCESS_KEY",
    !secretAccessKey && "EIE_STORAGE_SECRET_KEY",
  ].filter(Boolean);
}

async function testEndpoint(label, endpointUrl) {
  const client = new S3Client({
    region: "auto",
    endpoint: endpointUrl,
    credentials: { accessKeyId, secretAccessKey },
  });

  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 })
  );

  const testKey = `eie/connection-test/${Date.now()}.txt`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: "SkolaTech EIE R2 connection test",
      ContentType: "text/plain",
    })
  );
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));

  return {
    label,
    endpoint: endpointUrl,
    objectCountHint: listed.KeyCount ?? 0,
    testKey,
  };
}

async function main() {
  const unset = missing();
  if (unset.length > 0) {
    console.error("Missing env vars:", unset.join(", "));
    process.exit(1);
  }

  const candidates = [endpoint];
  if (endpoint.includes(".r2.cloudflarestorage.com") && !endpoint.includes(".eu.")) {
    candidates.push(endpoint.replace(".r2.cloudflarestorage.com", ".eu.r2.cloudflarestorage.com"));
  }

  let lastError;
  for (const candidate of [...new Set(candidates)]) {
    try {
      const result = await testEndpoint("primary", candidate);
      console.log(JSON.stringify({ ok: true, ...result }, null, 2));
      if (candidate !== endpoint) {
        console.log(
          "Note: configured endpoint failed; EU endpoint worked. Update EIE_STORAGE_ENDPOINT."
        );
      }
      return;
    } catch (error) {
      lastError = error;
      console.error(`Failed with ${candidate}:`, error.message ?? error);
    }
  }

  console.error("R2 connection test failed.");
  console.error(lastError?.message ?? lastError);
  process.exit(1);
}

main();
