import type { AccessRuleView } from "../abstractions/access-rule";

import { accessRuleSummaryKeys, rulesGoverningCollection } from "./access-rule-summary";

function rule(overrides: Record<string, unknown> = {}): AccessRuleView {
  return {
    id: "rule-1",
    name: "Production",
    enabled: true,
    conditions: [],
    singleActiveLease: false,
    collections: ["col-1"],
    ...overrides,
  } as unknown as AccessRuleView;
}

describe("accessRuleSummaryKeys", () => {
  it("reports auto-approval when no human-approval condition is set", () => {
    expect(accessRuleSummaryKeys(rule())).toEqual(["pamAccessRuleConditionAutoApproved"]);
  });

  it("reports required approval when the condition is set", () => {
    expect(accessRuleSummaryKeys(rule({ conditions: [{ kind: "human_approval" }] }))).toEqual([
      "pamAccessRuleConditionRequiresApproval",
    ]);
  });

  it("reports only the IP restriction when there is no human-approval condition", () => {
    const conditions = [{ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }];

    expect(accessRuleSummaryKeys(rule({ conditions }))).toEqual([
      "pamAccessRuleConditionIpRestricted",
    ]);
  });

  it("adds the single-active-lease restriction", () => {
    expect(accessRuleSummaryKeys(rule({ singleActiveLease: true }))).toEqual([
      "pamAccessRuleConditionAutoApproved",
      "pamAccessRuleSingleActiveUser",
    ]);
  });

  it("leads with the approval mode, then the restrictions, whatever order the conditions arrive in", () => {
    const conditions = [
      { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
      { kind: "human_approval" },
    ];

    expect(accessRuleSummaryKeys(rule({ conditions, singleActiveLease: true }))).toEqual([
      "pamAccessRuleConditionRequiresApproval",
      "pamAccessRuleConditionIpRestricted",
      "pamAccessRuleSingleActiveUser",
    ]);
  });

  it("ignores a condition kind this client does not know", () => {
    // The SDK passes newer kinds through unchanged; summarising one it cannot read would be a guess.
    const conditions = [{ kind: "something_new" }];

    expect(accessRuleSummaryKeys(rule({ conditions }))).toEqual([
      "pamAccessRuleConditionAutoApproved",
    ]);
  });
});

describe("rulesGoverningCollection", () => {
  it("keeps the rules covering the collection", () => {
    const rules = [
      rule({ id: "covers", collections: ["col-1", "col-2"] }),
      rule({ id: "elsewhere", collections: ["col-9"] }),
    ];

    expect(rulesGoverningCollection(rules, "col-1").map((r) => r.id)).toEqual(["covers"]);
  });

  it("excludes a disabled rule, which gates nothing", () => {
    // Naming one would tell an administrator their collection is governed when it is not.
    const rules = [rule({ id: "off", enabled: false })];

    expect(rulesGoverningCollection(rules, "col-1")).toEqual([]);
  });

  it("keeps every enabled rule covering the collection, not just the first", () => {
    const rules = [rule({ id: "a" }), rule({ id: "b" })];

    expect(rulesGoverningCollection(rules, "col-1").map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("is empty when nothing governs the collection", () => {
    expect(rulesGoverningCollection([rule({ collections: ["col-9"] })], "col-1")).toEqual([]);
  });

  it("is empty for an empty rule list", () => {
    expect(rulesGoverningCollection([], "col-1")).toEqual([]);
  });
});
