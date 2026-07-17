import { parseAllowAttribute } from "./allow-attribute-parser";
import { WebAuthnPermissionsPolicyFeature } from "./types";

const IFRAME_ORIGIN = "https://child.example";
const PARENT_ORIGIN = "https://parent.example";

function parse(raw: string) {
  return parseAllowAttribute(raw, IFRAME_ORIGIN, PARENT_ORIGIN);
}

describe("parseAllowAttribute", () => {
  describe("empty / malformed input", () => {
    it("returns an empty map for an empty string", () => {
      expect(parse("").size).toBe(0);
    });

    it("returns an empty map when only whitespace is present", () => {
      expect(parse("   ").size).toBe(0);
    });

    it("ignores empty directives between semicolons", () => {
      expect(parse(";;;").size).toBe(0);
      expect(parse("publickey-credentials-get; ;").size).toBe(1);
    });

    it("ignores directives whose feature name has invalid characters", () => {
      // The parser only rejects feature names with characters outside the
      // RFC 7230 token set we accept; it doesn't have a semantic whitelist
      // of "known" features (the resolver consumer handles that).
      expect(parse("123-bad-start").size).toBe(0);
      expect(parse("with*special!chars").size).toBe(0);
    });
  });

  describe("default allowlist (no items)", () => {
    it("treats a bare feature name as `'src'` (iframe's own origin)", () => {
      const policy = parse("publickey-credentials-get");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)).toEqual({
        feature: WebAuthnPermissionsPolicyFeature.Get,
        allowlist: [{ type: "origin", value: IFRAME_ORIGIN }],
      });
    });
  });

  describe("`'src'` keyword", () => {
    it("resolves to the iframe's own origin", () => {
      const policy = parse("publickey-credentials-get 'src'");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: IFRAME_ORIGIN },
      ]);
    });
  });

  describe("`'self'` keyword", () => {
    it("resolves to the iframe element's origin (= parent's origin)", () => {
      const policy = parse("publickey-credentials-get 'self'");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: PARENT_ORIGIN },
      ]);
    });
  });

  describe("`*` wildcard", () => {
    it("produces a wildcard allowlist item", () => {
      const policy = parse("publickey-credentials-get *");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "wildcard" },
      ]);
    });
  });

  describe("`'none'` keyword", () => {
    it("makes the allowlist empty even with other items present", () => {
      const policy = parse("publickey-credentials-get 'self' 'none' *");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)).toEqual({
        feature: WebAuthnPermissionsPolicyFeature.Get,
        allowlist: [],
      });
    });

    it("makes the allowlist empty when used alone", () => {
      const policy = parse("publickey-credentials-get 'none'");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([]);
    });
  });

  describe("explicit origins", () => {
    it("captures an https URL as an origin", () => {
      const policy = parse("publickey-credentials-get https://allowed.example");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: "https://allowed.example" },
      ]);
    });

    it("normalizes the origin via URL parsing (lowercases scheme/host, strips path)", () => {
      const policy = parse("publickey-credentials-get HTTPS://Allowed.Example/some/path");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: "https://allowed.example" },
      ]);
    });

    it("drops malformed origin tokens without failing the directive", () => {
      const policy = parse("publickey-credentials-get not-a-valid-url https://ok.example");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: "https://ok.example" },
      ]);
    });
  });

  describe("multiple items in one directive", () => {
    it("captures `'src'` and explicit origins together", () => {
      const policy = parse("publickey-credentials-get 'src' https://extra.example");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: IFRAME_ORIGIN },
        { type: "origin", value: "https://extra.example" },
      ]);
    });

    it("tolerates extra whitespace between items", () => {
      const policy = parse("publickey-credentials-get   'self'\t'src'   *");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: PARENT_ORIGIN },
        { type: "origin", value: IFRAME_ORIGIN },
        { type: "wildcard" },
      ]);
    });
  });

  describe("multiple directives", () => {
    it("captures multiple semicolon-separated directives", () => {
      const policy = parse("publickey-credentials-create; publickey-credentials-get 'self'");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Create)?.allowlist).toEqual([
        { type: "origin", value: IFRAME_ORIGIN },
      ]);
      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: PARENT_ORIGIN },
      ]);
    });

    it("applies 'later wins' when the same feature is repeated", () => {
      const policy = parse(
        "publickey-credentials-get 'self'; publickey-credentials-get https://later.example",
      );

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: "https://later.example" },
      ]);
    });

    it("tolerates a trailing semicolon", () => {
      const policy = parse("publickey-credentials-get 'self';");

      expect(policy.size).toBe(1);
      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)).toBeDefined();
    });

    it("tolerates leading/trailing whitespace around directives", () => {
      const policy = parse("   publickey-credentials-create ;   publickey-credentials-get 'src'  ");

      expect(policy.size).toBe(2);
    });
  });

  describe("feature name normalization", () => {
    it("lowercases the feature name", () => {
      const policy = parse("PublicKey-Credentials-Get 'self'");

      // Spec name is fully lowercase; we normalize on parse so consumers
      // can rely on lowercase keys regardless of input casing.
      expect(policy.has(WebAuthnPermissionsPolicyFeature.Get)).toBe(true);
    });
  });
});
