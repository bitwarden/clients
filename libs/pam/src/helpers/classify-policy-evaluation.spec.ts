import { classifyPolicyEvaluation } from "./classify-policy-evaluation";

describe("classifyPolicyEvaluation", () => {
  it("classifies human_approval as human", () => {
    expect(classifyPolicyEvaluation({ kind: "human_approval" })).toBe("human");
  });

  it("classifies ip_allowlist as automated", () => {
    expect(classifyPolicyEvaluation({ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] })).toBe(
      "automated",
    );
  });

  it("classifies time_of_day as automated", () => {
    expect(
      classifyPolicyEvaluation({ kind: "time_of_day", windows: [], tz: "UTC" }),
    ).toBe("automated");
  });

  it("classifies all_of as human when any child is human", () => {
    expect(
      classifyPolicyEvaluation({
        kind: "all_of",
        children: [
          { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
          { kind: "human_approval" },
        ],
      }),
    ).toBe("human");
  });

  it("classifies all_of as automated when no child is human", () => {
    expect(
      classifyPolicyEvaluation({
        kind: "all_of",
        children: [
          { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
          { kind: "time_of_day", windows: [], tz: "UTC" },
        ],
      }),
    ).toBe("automated");
  });

  it("recurses into nested all_of", () => {
    expect(
      classifyPolicyEvaluation({
        kind: "all_of",
        children: [
          {
            kind: "all_of",
            children: [{ kind: "human_approval" }],
          },
        ],
      }),
    ).toBe("human");
  });

  it("classifies empty all_of as automated", () => {
    expect(classifyPolicyEvaluation({ kind: "all_of", children: [] })).toBe("automated");
  });
});
