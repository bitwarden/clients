import { AccessCondition } from "../abstractions/access-rule";

import { approvalMethodLabelKeys } from "./approval-method";

describe("approvalMethodLabelKeys", () => {
  it("returns only the auto-approved key when there are no conditions", () => {
    expect(approvalMethodLabelKeys([])).toEqual(["pamAccessRuleConditionAutoApproved"]);
  });

  it("returns only the approval key when human approval is required", () => {
    const conditions = [{ kind: "human_approval" }] as AccessCondition[];

    expect(approvalMethodLabelKeys(conditions)).toEqual(["pamAccessRuleConditionRequiresApproval"]);
  });

  it("returns only the ip-restricted key when gated solely by an ip allowlist", () => {
    const conditions = [{ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }] as AccessCondition[];

    expect(approvalMethodLabelKeys(conditions)).toEqual(["pamAccessRuleConditionIpRestricted"]);
  });

  it("returns both keys, approval first, when both conditions are present", () => {
    const conditions = [
      { kind: "human_approval" },
      { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
    ] as AccessCondition[];

    expect(approvalMethodLabelKeys(conditions)).toEqual([
      "pamAccessRuleConditionRequiresApproval",
      "pamAccessRuleConditionIpRestricted",
    ]);
  });
});
