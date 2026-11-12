import { PamInputError } from "../shared/pam-input-error";

import {
  accessRuleTemplate,
  parseAccessRuleJson,
  parseAccessRuleRequest,
} from "./access-rule-request";

const COLLECTION = "33333333-3333-4333-8333-333333333333";
const validCidr = (v: string) => /^10\.0\.0\.0\/8$/.test(v);

function rule(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...JSON.parse(JSON.stringify(accessRuleTemplate())), ...overrides };
}

const parse = (overrides: Record<string, unknown> = {}) =>
  parseAccessRuleRequest(rule(overrides), validCidr);

describe("parseAccessRuleRequest", () => {
  it("accepts the template", () => {
    expect(parse().name).toBe("Example rule");
  });

  it("trims the name and keeps exact seconds", () => {
    const result = parse({ name: "  Prod  ", defaultLeaseDurationSeconds: 61 });
    expect(result.name).toBe("Prod");
    expect(result.defaultLeaseDurationSeconds).toBe(61);
  });

  it.each([[""], ["   "], ["x".repeat(257)]])("refuses the name %#", (name) => {
    expect(() => parse({ name })).toThrow(PamInputError);
  });

  it("refuses more than 10 conditions", () => {
    const conditions = Array.from({ length: 11 }, () => ({ kind: "human_approval" }));
    expect(() => parse({ conditions })).toThrow(/at most 10/);
  });

  it("refuses an empty ip_allowlist and an invalid CIDR", () => {
    expect(() => parse({ conditions: [{ kind: "ip_allowlist", cidrs: [] }] })).toThrow(
      /at least one CIDR/,
    );
    expect(() => parse({ conditions: [{ kind: "ip_allowlist", cidrs: ["bad"] }] })).toThrow(
      /not a valid CIDR/,
    );
    expect(
      parse({ conditions: [{ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }] }).conditions,
    ).toEqual([{ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }]);
  });

  it("refuses an unknown condition kind", () => {
    expect(() => parse({ conditions: [{ kind: "other" }] })).toThrow(PamInputError);
  });

  it.each([[0], [-1], [1.5], [365 * 86400 + 1], ["60"]])("refuses duration %p", (value) => {
    expect(() => parse({ maxLeaseDurationSeconds: value })).toThrow(PamInputError);
  });

  it("accepts exactly 365 days", () => {
    expect(parse({ maxLeaseDurationSeconds: 365 * 86400 }).maxLeaseDurationSeconds).toBe(
      365 * 86400,
    );
  });

  it("refuses default longer than max", () => {
    expect(() => parse({ defaultLeaseDurationSeconds: 100, maxLeaseDurationSeconds: 50 })).toThrow(
      /cannot be longer/,
    );
  });

  it("requires a positive extension length when extensions are allowed", () => {
    expect(() => parse({ allowsExtensions: true })).toThrow(/maxExtensionDurationSeconds/);
    expect(() => parse({ allowsExtensions: true, maxExtensionDurationSeconds: 0 })).toThrow(
      PamInputError,
    );
    expect(
      parse({ allowsExtensions: true, maxExtensionDurationSeconds: 600 })
        .maxExtensionDurationSeconds,
    ).toBe(600);
  });

  it("lowercases and de-duplicates collections, and refuses non-GUIDs", () => {
    expect(parse({ collections: [COLLECTION.toUpperCase(), COLLECTION] }).collections).toEqual([
      COLLECTION,
    ]);
    expect(() => parse({ collections: ["nope"] })).toThrow(PamInputError);
    expect(() => parse({ collections: [5] })).toThrow(PamInputError);
  });

  it("refuses unknown and missing fields instead of defaulting them", () => {
    expect(() => parse({ colections: [] })).toThrow(/not a field/);
    const missing = rule();
    delete missing.collections;
    expect(() => parseAccessRuleRequest(missing, validCidr)).toThrow(/missing `collections`/);
    expect(() => parseAccessRuleRequest([], validCidr)).toThrow(PamInputError);
  });
});

describe("parseAccessRuleJson", () => {
  it("parses JSON and base64 JSON", () => {
    expect(parseAccessRuleJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseAccessRuleJson(Buffer.from('{"a":2}').toString("base64"))).toEqual({ a: 2 });
  });

  it("refuses empty or invalid text without echoing it", () => {
    expect(() => parseAccessRuleJson("")).toThrow(/not provided/);
    expect(() => parseAccessRuleJson("{secret-value")).toThrow(
      "The rule could not be parsed as JSON.",
    );
  });
});
