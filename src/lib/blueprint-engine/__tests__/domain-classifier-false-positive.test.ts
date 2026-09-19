import { describe, expect, it } from "vitest";
import { buildBlueprintSeedFromWizard } from "@/lib/blueprint-engine/extract/from-wizard-context";
import { inferSalesCrmDomain, planDomainEntities } from "@/lib/blueprint-engine/plan/domain-entity-planner";
import type { ProjectContext } from "@/lib/ai-prompts";

// Real field values submitted for the "Frozests" cold-storage project — sanity check
// that the narrowed inferAiAgents/inferSalesCrmDomain regexes no longer misfire on them.
const frozestsCtx: ProjectContext = {
  appName: "Frozests",
  shortDescription:
    "A modular, multi-tenant operating platform for cold-storage and frozen-food businesses. Launches as a staff-operated storage POS (check-in, weight-and-time pricing, labeling, payments, pickup) while retail, customer self-service, delivery, subscriptions and IoT remain architecturally ready but disabled.",
  longDescription:
    'Launch scope (must be fully functional): auth/RBAC across Platform Admin, Tenant Admin/Owner, Manager, Agent with platform vs tenant scopes kept separate; customer creation/search; storage check-in with multi-package handling; weight-and-time pricing engine (24-hour minimum + hourly top-up, configuration-driven, not hard-coded); expected pickup + prepayment; storage order receipts and freezer-safe package labels (QR/barcode, unique per physical package); freezer/location assignment and transfer history; active storage dashboard and search; pickup verification (scan-to-match, blocks wrong-package release) with additional billing and release; payments/receipts (cash, bank transfer, card terminal, split payments); reports and shift/cash reconciliation; immutable audit trail for all sensitive actions; offline-capable core POS workflow with idempotent sync; local POS device settings; admin configuration and per-tenant feature/module toggles. Architected now but kept disabled until later: retail sales POS + product catalogue, inventory/suppliers/batches/expiry, customer login/account, reservations/subscriptions, online storefront, delivery fulfilment, temperature/door/energy IoT monitoring.',
  mainFeatures:
    "Auth + role-based access (platform vs tenant scopes); customer creation/search; storage check-in with multi-package intake; weight-and-time pricing engine with 24h minimum + hourly top-up; pickup workflow with scan-to-verify, balance settlement, manager-authorised exception releases; payments (cash/bank transfer/card terminal/split) and immutable receipts; offline-capable core POS (locally generated IDs, idempotent sync, ONLINE/OFFLINE/SYNCING status); tenant branding applied across POS, receipts, labels, reports.",
  adminFeatures:
    "Admin Portal: overview dashboard; users, roles and permissions; pricing rules; freezers and storage locations; module/feature toggles; device policy; reports and audit log viewer.",
  integrationNeeds:
    "Hardware adapters (vendor-agnostic): weight scale, QR/barcode scanner, receipt printer, label printer. Future: IoT gateway/MQTT for temperature/door sensors, Modbus/API for solar/inverter monitoring, online payment gateway (Paystack/Flutterwave).",
  hostingProvider: "Vercel",
  database: "Neon (Postgres)",
  authProvider: "Clerk",
  frontendFramework: "Next.js (React)",
  backendFramework: "Next.js (API routes / server actions, full-stack)",
  paymentProvider: "Paystack / Flutterwave",
  multiTenancy: true,
  fileUpload: false,
  userRoles: "Platform Admin; Tenant Admin/Owner; Manager; Agent",
  securityLevel: "high",
};

describe("Frozests false-positive regression", () => {
  it("does not classify a cold-storage POS as an AI-agent SaaS", () => {
    const seed = buildBlueprintSeedFromWizard(frozestsCtx);
    expect(seed.classification.hasAiAgents).toBe(false);
    expect(seed.entities.workflow_run_events).toBeUndefined();
    expect(seed.stack.aiGateway).toBeUndefined();
  });

  it("does not classify a cold-storage POS as a sales CRM domain", () => {
    expect(inferSalesCrmDomain(frozestsCtx)).toBe(false);
    const domain = planDomainEntities(frozestsCtx, {
      multiTenant: true,
      hasAiAgents: false,
      hasFileUpload: false,
      hasAsyncProcessing: false,
      hasRealtime: false,
    });
    expect(domain.contacts).toBeUndefined();
    expect(domain.leads).toBeUndefined();
    expect(domain.follow_ups).toBeUndefined();
    expect(domain.interactions).toBeUndefined();
  });
});
