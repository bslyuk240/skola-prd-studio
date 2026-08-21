export const PLATFORM_TYPES = [
  { value: "web", label: "Web App" },
  { value: "mobile", label: "Native Mobile" },
  { value: "cross-platform", label: "Cross-Platform" },
  { value: "saas-dashboard", label: "SaaS Dashboard" },
  { value: "marketplace", label: "Marketplace" },
  { value: "admin-portal", label: "Admin Portal" },
  { value: "ai-app", label: "AI-Powered App" },
] as const;

export const STACK_OPTIONS = {
  frontend: ["Next.js", "React", "Vue.js", "Nuxt.js", "SvelteKit", "Angular", "React Native", "Flutter", "Expo"],
  backend: ["Next.js API Routes", "Node.js / Express", "FastAPI (Python)", "Django", "NestJS", "Hono", "Laravel (PHP)", "Ruby on Rails"],
  database: ["PostgreSQL (Neon)", "PostgreSQL (Supabase)", "MySQL", "MongoDB", "SQLite", "PlanetScale", "Turso"],
  auth: ["Clerk", "Auth.js (NextAuth)", "Supabase Auth", "Firebase Auth", "Custom JWT", "Auth0"],
  hosting: ["Vercel", "Netlify", "Railway", "Render", "AWS", "GCP", "Azure", "Fly.io"],
  storage: ["Cloudflare R2", "AWS S3", "Supabase Storage", "Uploadthing", "Cloudinary", "None"],
  payment: ["Stripe", "Paddle", "LemonSqueezy", "PayPal", "Paystack", "None"],
} as const;

export type StackFieldKey = keyof typeof STACK_OPTIONS;

export const STACK_FIELD_LABELS: Record<StackFieldKey, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Database",
  auth: "Auth",
  hosting: "Hosting",
  storage: "Storage",
  payment: "Payment",
};
