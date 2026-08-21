import { config } from "dotenv";
import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

config({ path: ".env.local" });

const bucket = process.env.EIE_STORAGE_BUCKET;
const endpoint = process.env.EIE_STORAGE_ENDPOINT;
const accessKeyId = process.env.EIE_STORAGE_ACCESS_KEY;
const secretAccessKey = process.env.EIE_STORAGE_SECRET_KEY;

function missingEnv() {
  return [
    !bucket && "EIE_STORAGE_BUCKET",
    !endpoint && "EIE_STORAGE_ENDPOINT",
    !accessKeyId && "EIE_STORAGE_ACCESS_KEY",
    !secretAccessKey && "EIE_STORAGE_SECRET_KEY",
  ].filter(Boolean);
}

function collectAllowedOrigins() {
  const origins = new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);

  for (const key of ["NEXT_PUBLIC_APP_URL", "URL", "DEPLOY_PRIME_URL"]) {
    const raw = process.env[key]?.trim();
    if (!raw?.startsWith("http")) continue;
    try {
      origins.add(new URL(raw).origin);
    } catch {
      // ignore invalid URLs
    }
  }

  // CORS Origin must match the browser Origin header exactly (no trailing slash).
  return [...origins];
}

async function main() {
  const unset = missingEnv();
  if (unset.length > 0) {
    console.error("Missing env vars:", unset.join(", "));
    process.exit(1);
  }

  const allowedOrigins = collectAllowedOrigins();
  if (allowedOrigins.length === 0) {
    console.error("No allowed origins found. Set NEXT_PUBLIC_APP_URL in .env.local.");
    process.exit(1);
  }

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    console.log("Current CORS rules:", JSON.stringify(current.CORSRules ?? [], null, 2));
  } catch (error) {
    console.log("No existing CORS rules (or unable to read):", error.message ?? error);
  }

  const corsRules = [
    {
      AllowedOrigins: allowedOrigins,
      AllowedMethods: ["GET", "PUT", "POST", "HEAD"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    },
  ];

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: { CORSRules: corsRules },
    })
  );

  console.log("Applied R2 CORS configuration:");
  console.log(JSON.stringify({ bucket, allowedOrigins, corsRules }, null, 2));
  console.log("\nBrowser uploads from these origins should now work.");
}

main().catch((error) => {
  console.error("Failed to configure R2 CORS:", error.message ?? error);
  process.exit(1);
});
