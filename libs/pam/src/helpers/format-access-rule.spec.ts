import { formatCondition, summarizeConditions } from "./format-access-rule";

describe("formatCondition", () => {
  it("returns pamAccessRuleHumanApproval for human_approval", () => {
    expect(formatCondition({ kind: "human_approval" })).toEqual({
      key: "pamAccessRuleHumanApproval",
    });
  });

  it("includes the cidr count for ip_allowlist", () => {
    expect(
      formatCondition({ kind: "ip_allowlist", cidrs: ["10.0.0.0/8", "192.168.0.0/16"] }),
    ).toEqual({ key: "pamAccessRuleIpAllowlist", params: { count: 2 } });
  });

  it("handles an ip_allowlist with no cidrs (count 0)", () => {
    expect(formatCondition({ kind: "ip_allowlist", cidrs: [] })).toEqual({
      key: "pamAccessRuleIpAllowlist",
      params: { count: 0 },
    });
  });
});

describe("summarizeConditions", () => {
  it("returns pamAccessRuleNone for an empty list", () => {
    expect(summarizeConditions([])).toEqual([{ key: "pamAccessRuleNone" }]);
  });

  it("summarises each condition in order", () => {
    expect(
      summarizeConditions([
        { kind: "human_approval" },
        { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
      ]),
    ).toEqual([
      { key: "pamAccessRuleHumanApproval" },
      { key: "pamAccessRuleIpAllowlist", params: { count: 1 } },
    ]);
  });
});
