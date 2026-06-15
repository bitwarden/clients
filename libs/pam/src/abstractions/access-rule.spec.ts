import {
  AccessConditionTree,
  parseAccessCondition,
  parseAccessConditions,
  parseConditionTree,
  treeToConditions,
} from "./access-rule";

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

  it("throws when the value is not an array", () => {
    expect(() => parseAccessConditions({ kind: "human_approval" })).toThrow("not an array");
  });
});

describe("parseConditionTree", () => {
  it("returns null for a non-object", () => {
    expect(parseConditionTree(null)).toBeNull();
    expect(parseConditionTree("nope")).toBeNull();
  });

  it("returns null for an unknown kind", () => {
    expect(parseConditionTree({ kind: "mystery" })).toBeNull();
  });

  it("parses a human_approval leaf", () => {
    expect(parseConditionTree({ kind: "human_approval" })).toEqual({ kind: "human_approval" });
  });

  it("parses an ip_allowlist leaf, defaulting missing cidrs to []", () => {
    expect(parseConditionTree({ kind: "ip_allowlist" })).toEqual({
      kind: "ip_allowlist",
      cidrs: [],
    });
  });

  it("parses an all_of node, dropping unparseable children", () => {
    const tree = parseConditionTree({
      kind: "all_of",
      conditions: [
        { kind: "human_approval" },
        { kind: "mystery" },
        { kind: "ip_allowlist", cidrs: ["::/0"] },
      ],
    });
    expect(tree).toEqual({
      kind: "all_of",
      conditions: [{ kind: "human_approval" }, { kind: "ip_allowlist", cidrs: ["::/0"] }],
    });
  });

  it("treats a non-array all_of conditions as empty", () => {
    expect(parseConditionTree({ kind: "all_of", conditions: "nope" })).toEqual({
      kind: "all_of",
      conditions: [],
    });
  });
});

describe("treeToConditions", () => {
  it("flattens a human_approval leaf (approvers are not carried on the tree)", () => {
    expect(treeToConditions({ kind: "human_approval" })).toEqual([{ kind: "human_approval" }]);
  });

  it("flattens an ip_allowlist leaf", () => {
    expect(treeToConditions({ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] })).toEqual([
      { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
    ]);
  });

  it("flattens a nested all_of into a flat condition list", () => {
    const tree: AccessConditionTree = {
      kind: "all_of",
      conditions: [
        { kind: "human_approval" },
        { kind: "all_of", conditions: [{ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }] },
      ],
    };
    expect(treeToConditions(tree)).toEqual([
      { kind: "human_approval" },
      { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
    ]);
  });

  it("round-trips parseConditionTree → treeToConditions", () => {
    const tree = parseConditionTree({
      kind: "all_of",
      conditions: [{ kind: "human_approval" }, { kind: "ip_allowlist", cidrs: ["192.168.0.0/16"] }],
    });
    expect(treeToConditions(tree!)).toEqual([
      { kind: "human_approval" },
      { kind: "ip_allowlist", cidrs: ["192.168.0.0/16"] },
    ]);
  });
});
