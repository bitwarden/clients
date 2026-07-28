import type { AccessRuleAddEditRequest, AccessRuleView } from "../abstractions/access-rule";

import { accessRuleToRequest } from "./access-rule-request";

function rule(overrides: Partial<AccessRuleView> = {}): AccessRuleView {
  return {
    id: "rule-1",
    organizationId: "org-1",
    name: "Approval + IP",
    description: "Break-glass production access",
    enabled: true,
    conditions: [{ kind: "human_approval" }, { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }],
    singleActiveLease: false,
    defaultLeaseDurationSeconds: 3600,
    maxLeaseDurationSeconds: 14400,
    allowsExtensions: true,
    maxExtensionDurationSeconds: 1800,
    collections: ["col-1"],
    creationDate: "2024-01-01T00:00:00.000Z",
    revisionDate: "2024-01-01T00:00:00.000Z",
    ...overrides,
  } as unknown as AccessRuleView;
}

describe("accessRuleToRequest", () => {
  it("copies every field from the view and overrides only `enabled`", () => {
    const req = accessRuleToRequest(rule(), false);

    expect(req).toEqual<AccessRuleAddEditRequest>({
      name: "Approval + IP",
      description: "Break-glass production access",
      conditions: [{ kind: "human_approval" }, { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }],
      collections: ["col-1"],
      defaultLeaseDurationSeconds: 3600,
      maxLeaseDurationSeconds: 14400,
      singleActiveLease: false,
      enabled: false,
      allowsExtensions: true,
      maxExtensionDurationSeconds: 1800,
    } as unknown as AccessRuleAddEditRequest);
  });

  it("overrides enabled independently of the rule's current state", () => {
    const req = accessRuleToRequest(rule({ enabled: false }), true);

    expect(req.enabled).toBe(true);
  });

  it("preserves allowsExtensions and maxExtensionDurationSeconds — a bulk-toggle must not silently disable extensions", () => {
    const req = accessRuleToRequest(
      rule({ allowsExtensions: true, maxExtensionDurationSeconds: 7200 }),
      true,
    );

    expect(req.allowsExtensions).toBe(true);
    expect(req.maxExtensionDurationSeconds).toBe(7200);
  });

  it("preserves undefined optional fields as undefined", () => {
    const req = accessRuleToRequest(
      rule({
        description: undefined,
        defaultLeaseDurationSeconds: undefined,
        maxLeaseDurationSeconds: undefined,
        maxExtensionDurationSeconds: undefined,
      }),
      true,
    );

    expect(req.description).toBeUndefined();
    expect(req.defaultLeaseDurationSeconds).toBeUndefined();
    expect(req.maxLeaseDurationSeconds).toBeUndefined();
    expect(req.maxExtensionDurationSeconds).toBeUndefined();
  });
});
