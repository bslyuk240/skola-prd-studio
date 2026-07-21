import { describe, expect, it } from "vitest";
import { EIE_ADMIN_ROLES } from "@/lib/eie/constants";
import { isEieEnabledForProject } from "@/lib/eie/project-settings";
import type { Project } from "@/db/schema";

describe("auth boundaries", () => {
  it("defines admin roles for EIE routes", () => {
    expect(EIE_ADMIN_ROLES).toContain("admin");
    expect(EIE_ADMIN_ROLES).toContain("platform_admin");
    expect(EIE_ADMIN_ROLES).not.toContain("user");
  });
});

describe("PRD enrichment without EIE data", () => {
  it("treats missing toggle as enabled by default", () => {
    const project = { wizardData: {} } as Project;
    expect(isEieEnabledForProject(project)).toBe(true);
  });

  it("respects explicit disable flag", () => {
    const project = {
      wizardData: { enableEieCrossReferencing: false },
    } as Project;
    expect(isEieEnabledForProject(project)).toBe(false);
  });
});
