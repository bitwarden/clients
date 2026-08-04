import type {
  AccessCondition,
  AccessRuleAddEditRequest,
  AccessRuleView,
} from "../abstractions/access-rule";

import {
  accessRuleToFormValue,
  accessRuleToRequest,
  AccessRuleFormValue,
  formValueToRequest,
  NO_DURATION_CAP,
} from "./access-rule-request";
import { DEFAULT_MAX_EXTENSION_DURATION_SECONDS } from "./lease-window.utils";

function formValue(overrides: Partial<AccessRuleFormValue> = {}): AccessRuleFormValue {
  return {
    name: "Approval + IP",
    description: "Break-glass production access",
    collections: [{ id: "col-1" }, { id: "col-2" }],
    defaultLeaseDurationSeconds: 3600,
    maxLeaseDurationSeconds: 14400,
    singleActiveLease: false,
    enabled: true,
    allowsExtensions: true,
    maxExtensionDurationSeconds: 1800,
    humanApprovalEnabled: false,
    ipAllowlistEnabled: false,
    ipAllowlistCidrs: [],
    ...overrides,
  };
}

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

describe("formValueToRequest", () => {
  it("maps a plain form value straight through, with no conditions when both toggles are off", () => {
    const req = formValueToRequest(formValue(), []);

    expect(req).toEqual<AccessRuleAddEditRequest>({
      name: "Approval + IP",
      description: "Break-glass production access",
      conditions: [],
      collections: ["col-1", "col-2"],
      defaultLeaseDurationSeconds: 3600,
      maxLeaseDurationSeconds: 14400,
      singleActiveLease: false,
      enabled: true,
      allowsExtensions: true,
      maxExtensionDurationSeconds: 1800,
    } as unknown as AccessRuleAddEditRequest);
  });

  it("builds the human_approval and ip_allowlist conditions from their toggles", () => {
    const req = formValueToRequest(
      formValue({
        humanApprovalEnabled: true,
        ipAllowlistEnabled: true,
        ipAllowlistCidrs: ["10.0.0.0/8", "192.168.0.0/16"],
      }),
      [],
    );

    expect(req.conditions).toEqual([
      { kind: "human_approval" },
      { kind: "ip_allowlist", cidrs: ["10.0.0.0/8", "192.168.0.0/16"] },
    ]);
  });

  it("trims and drops blank CIDR rows before emitting the ip_allowlist condition", () => {
    const req = formValueToRequest(
      formValue({
        ipAllowlistEnabled: true,
        ipAllowlistCidrs: ["  10.0.0.0/8  ", "", "   "],
      }),
      [],
    );

    expect(req.conditions).toEqual([{ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }]);
  });

  it("omits the ip_allowlist condition entirely when its toggle is off, even with leftover rows", () => {
    const req = formValueToRequest(
      formValue({ ipAllowlistEnabled: false, ipAllowlistCidrs: ["10.0.0.0/8"] }),
      [],
    );

    expect(req.conditions).toEqual([]);
  });

  it("carries unknown conditions forward, appended after the rebuilt known ones", () => {
    // `time_of_day` is deliberately a kind the client doesn't model — the reason
    // unknownConditions exists — so it isn't in the SDK's AccessCondition union.
    const unknown = [
      { kind: "time_of_day", start: "09:00", end: "17:00" },
    ] as unknown as AccessCondition[];

    const req = formValueToRequest(formValue({ humanApprovalEnabled: true }), unknown);

    expect(req.conditions).toEqual([{ kind: "human_approval" }, ...unknown]);
  });

  it("encodes an empty description as undefined", () => {
    const req = formValueToRequest(formValue({ description: "" }), []);

    expect(req.description).toBeUndefined();
  });

  it("encodes a NO_DURATION_CAP max as undefined (no cap)", () => {
    const req = formValueToRequest(formValue({ maxLeaseDurationSeconds: NO_DURATION_CAP }), []);

    expect(req.maxLeaseDurationSeconds).toBeUndefined();
  });

  it("drops maxExtensionDurationSeconds when extensions are disabled", () => {
    const req = formValueToRequest(
      formValue({ allowsExtensions: false, maxExtensionDurationSeconds: 7200 }),
      [],
    );

    expect(req.allowsExtensions).toBe(false);
    expect(req.maxExtensionDurationSeconds).toBeUndefined();
  });
});

describe("accessRuleToFormValue", () => {
  it("maps a rule onto the patchable form fields, omitting collections and CIDR rows", () => {
    const value = accessRuleToFormValue(rule());

    expect(value).toEqual({
      name: "Approval + IP",
      description: "Break-glass production access",
      defaultLeaseDurationSeconds: 3600,
      maxLeaseDurationSeconds: 14400,
      singleActiveLease: false,
      enabled: true,
      allowsExtensions: true,
      maxExtensionDurationSeconds: 1800,
      humanApprovalEnabled: true,
      ipAllowlistEnabled: true,
    });
  });

  it("drives the condition checkboxes off the rule's conditions", () => {
    expect(accessRuleToFormValue(rule({ conditions: [] }))).toMatchObject({
      humanApprovalEnabled: false,
      ipAllowlistEnabled: false,
    });
    expect(accessRuleToFormValue(rule({ conditions: [{ kind: "human_approval" }] }))).toMatchObject(
      { humanApprovalEnabled: true, ipAllowlistEnabled: false },
    );
  });

  it("snaps off-preset durations to their nearest picker option", () => {
    const value = accessRuleToFormValue(
      rule({ defaultLeaseDurationSeconds: 3500, maxExtensionDurationSeconds: 1700 }),
    );

    expect(value.defaultLeaseDurationSeconds).toBe(3600); // nearest lease preset (1h)
    expect(value.maxExtensionDurationSeconds).toBe(1800); // nearest extension option (30m)
  });

  it("encodes an absent max lease as NO_DURATION_CAP (no cap)", () => {
    const value = accessRuleToFormValue(rule({ maxLeaseDurationSeconds: undefined }));

    expect(value.maxLeaseDurationSeconds).toBe(NO_DURATION_CAP);
  });

  it("falls back to the default max extension when none is stored", () => {
    const value = accessRuleToFormValue(rule({ maxExtensionDurationSeconds: undefined }));

    expect(value.maxExtensionDurationSeconds).toBe(DEFAULT_MAX_EXTENSION_DURATION_SECONDS);
  });

  it("normalises an absent description to an empty string", () => {
    const value = accessRuleToFormValue(rule({ description: undefined }));

    expect(value.description).toBe("");
  });
});
