/** Server-only booleans for admin connection status — never expose secret values. */
export interface EnvConnectionStatus {
  core: {
    openRouter: boolean;
    database: boolean;
    clerkSecret: boolean;
    clerkPublishable: boolean;
  };
  eie: {
    qstashToken: boolean;
    qstashUrl: boolean;
    internalWebhookSecret: boolean;
    backgroundFunctionSecret: boolean;
    appUrl: boolean;
  };
  storage: {
    bucket: boolean;
    endpoint: boolean;
    accessKey: boolean;
    secretKey: boolean;
  };
  display: {
    storageBucket: string | null;
    qstashUrl: string | null;
    appUrl: string | null;
    netlifyUrlSet: boolean;
  };
}

export function getEnvConnectionStatus(): EnvConnectionStatus {
  return {
    core: {
      openRouter: !!process.env.OPENROUTER_API_KEY,
      database: !!process.env.DATABASE_URL,
      clerkSecret: !!process.env.CLERK_SECRET_KEY,
      clerkPublishable: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    },
    eie: {
      qstashToken: !!process.env.UPSTASH_QSTASH_TOKEN,
      qstashUrl: !!process.env.QSTASH_URL,
      internalWebhookSecret: !!process.env.EIE_INTERNAL_WEBHOOK_SECRET,
      backgroundFunctionSecret: !!process.env.BACKGROUND_FUNCTION_SECRET,
      appUrl: !!(process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL),
    },
    storage: {
      bucket: !!process.env.EIE_STORAGE_BUCKET,
      endpoint: !!process.env.EIE_STORAGE_ENDPOINT,
      accessKey: !!process.env.EIE_STORAGE_ACCESS_KEY,
      secretKey: !!process.env.EIE_STORAGE_SECRET_KEY,
    },
    display: {
      storageBucket: process.env.EIE_STORAGE_BUCKET ?? null,
      qstashUrl: process.env.QSTASH_URL ?? null,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? null,
      netlifyUrlSet: !!process.env.URL,
    },
  };
}

export function isStorageConfigured(status: EnvConnectionStatus): boolean {
  return (
    status.storage.bucket &&
    status.storage.endpoint &&
    status.storage.accessKey &&
    status.storage.secretKey
  );
}

export function isEiePipelineConfigured(status: EnvConnectionStatus): boolean {
  return (
    status.eie.qstashToken &&
    status.eie.internalWebhookSecret &&
    status.eie.appUrl
  );
}
