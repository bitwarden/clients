import { parseAccessCondition, parseAccessConditions } from "./access-rule";

describe("parseAccessCondition", () => {
  it("parses a human_approval condition without approvers", () => {
    expect(parseAccessCondition({ kind: "human_approval" })).toEqual({ kind: "human_approval" });
  });

  it("parses collection_managers approvers", () => {
    expect(
      parseAccessCondition({ kind: "human_approval", approvers: { mode: "collection_managers" } }),
    ).toEqual({ kind: "human_approval", approvers: { mode: "collection_managers" } });
  });

  it("parses specific approvers, coercing user ids to strings", () => {
    expect(
      parseAccessCondition({
        kind: "human_approval",
        approvers: { mode: "specific", userIds: [1, "b"] },
      }),
    ).toEqual({ kind: "human_approval", approvers: { mode: "specific", userIds: ["1", "b"] } });
  });

  it("drops an unrecognised approver mode back to bare human_approval", () => {
    expect(
      parseAccessCondition({ kind: "human_approval", approvers: { mode: "nonsense" } }),
    ).toEqual({ kind: "human_approval" });
  });

  it("parses an ip_allowlist condition", () => {
    expect(parseAccessCondition({ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] })).toEqual({
      kind: "ip_allowlist",
      cidrs: ["10.0.0.0/8"],
    });
  });

  it("accepts PascalCase keys from the wire", () => {
    expect(parseAccessCondition({ Kind: "ip_allowlist", Cidrs: ["10.0.0.0/8"] })).toEqual({
      kind: "ip_allowlist",
      cidrs: ["10.0.0.0/8"],
    });
  });

  it("throws on a non-object", () => {
    expect(() => parseAccessCondition(null)).toThrow("not an object");
    expect(() => parseAccessCondition("nope")).toThrow("not an object");
  });

  it("throws on an unknown kind", () => {
    expect(() => parseAccessCondition({ kind: "mystery" })).toThrow('unknown kind "mystery"');
  });
});

describe("parseAccessConditions", () => {
  it("returns an empty list for null/undefined", () => {
    expect(parseAccessConditions(null)).toEqual([]);
    expect(parseAccessConditions(undefined)).toEqual([]);
  });

  it("maps each element through parseAccessCondition", () => {
    expect(
      parseAccessConditions([{ kind: "human_approval" }, { kind: "ip_allowlist", cidrs: [] }]),
    ).toEqual([{ kind: "human_approval" }, { kind: "ip_allowlist", cidrs: [] }]);
  });

  it("returns an empty list for an empty array", () => {
    expect(parseAccessConditions([])).toEqual([]);
  });

  it("throws when the value is not an array", () => {
    expect(() => parseAccessConditions({ kind: "human_approval" })).toThrow("not an array");
  });

  it("propagates parse errors for malformed entries", () => {
    expect(() => parseAccessConditions([{ kind: "mystery" }])).toThrow('unknown kind "mystery"');
  });
});
