import { LeasingPolicy } from "../abstractions/leasing-policy";

import { flattenLeasingPolicy, formatLeasingPolicy } from "./format-leasing-policy";

describe("formatLeasingPolicy", () => {
  it("returns pamPolicyNone when policy is null", () => {
    expect(formatLeasingPolicy(null)).toEqual({ key: "pamPolicyNone" });
  });

  it("returns pamPolicyHumanApproval for human_approval", () => {
    expect(formatLeasingPolicy({ kind: "human_approval" })).toEqual({
      key: "pamPolicyHumanApproval",
    });
  });

  it("includes the cidr count for ip_allowlist", () => {
    expect(
      formatLeasingPolicy({ kind: "ip_allowlist", cidrs: ["10.0.0.0/8", "192.168.0.0/16"] }),
    ).toEqual({ key: "pamPolicyIpAllowlist", params: { count: 2 } });
  });

  it("handles an ip_allowlist with no cidrs (count 0)", () => {
    expect(formatLeasingPolicy({ kind: "ip_allowlist", cidrs: [] })).toEqual({
      key: "pamPolicyIpAllowlist",
      params: { count: 0 },
    });
  });

  it("includes the window count for time_of_day", () => {
    expect(
      formatLeasingPolicy({
        kind: "time_of_day",
        windows: [{ daysOfWeek: [1, 2, 3, 4, 5], from: "09:00", to: "17:00" }],
        tz: "America/New_York",
      }),
    ).toEqual({ key: "pamPolicyTimeOfDay", params: { count: 1 } });
  });

  it("includes the child count for all_of", () => {
    expect(
      formatLeasingPolicy({
        kind: "all_of",
        children: [{ kind: "human_approval" }, { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }],
      }),
    ).toEqual({ key: "pamPolicyAllOf", params: { count: 2 } });
  });

  it("collapses an empty all_of to pamPolicyEmpty", () => {
    expect(formatLeasingPolicy({ kind: "all_of", children: [] })).toEqual({
      key: "pamPolicyEmpty",
    });
  });
});

describe("flattenLeasingPolicy", () => {
  it("returns a single pamPolicyNone entry for null", () => {
    expect(flattenLeasingPolicy(null)).toEqual([{ key: "pamPolicyNone" }]);
  });

  it("returns a single entry for a leaf policy", () => {
    expect(flattenLeasingPolicy({ kind: "human_approval" })).toEqual([
      { key: "pamPolicyHumanApproval" },
    ]);
  });

  it("flattens nested all_of policies in order", () => {
    const policy: LeasingPolicy = {
      kind: "all_of",
      children: [
        { kind: "human_approval" },
        {
          kind: "all_of",
          children: [{ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }],
        },
        {
          kind: "time_of_day",
          windows: [
            { daysOfWeek: [1], from: "09:00", to: "17:00" },
            { daysOfWeek: [2], from: "09:00", to: "17:00" },
          ],
          tz: "UTC",
        },
      ],
    };

    expect(flattenLeasingPolicy(policy)).toEqual([
      { key: "pamPolicyHumanApproval" },
      { key: "pamPolicyIpAllowlist", params: { count: 1 } },
      { key: "pamPolicyTimeOfDay", params: { count: 2 } },
    ]);
  });
});
