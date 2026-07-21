import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const envPath = ".env.local";
let content = readFileSync(envPath, "utf-8");

if (!/^EIE_INTERNAL_WEBHOOK_SECRET=.+$/m.test(content)) {
  const secret = randomBytes(32).toString("hex");
  content = content.replace(
    /^EIE_INTERNAL_WEBHOOK_SECRET=.*$/m,
    `EIE_INTERNAL_WEBHOOK_SECRET=${secret}`
  );
}

if (!/^URL=.+$/m.test(content)) {
  content = content.replace(
    /^NEXT_PUBLIC_APP_URL=http:\/\/localhost:3000$/m,
    "NEXT_PUBLIC_APP_URL=http://localhost:3000\n\n# Netlify sets URL automatically in production\nURL=http://localhost:3000"
  );
}

writeFileSync(envPath, content);
console.log("Updated .env.local (webhook secret generated if missing).");
