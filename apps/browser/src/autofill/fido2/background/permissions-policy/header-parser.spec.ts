import { parseHeader } from "./header-parser";
import { WebAuthnPermissionsPolicyFeature } from "./types";

describe("parseHeader", () => {
  describe("empty / malformed input", () => {
    it("returns an empty map for an empty string", () => {
      expect(parseHeader("").size).toBe(0);
    });

    it("returns an empty map for whitespace only", () => {
      expect(parseHeader("   \t   ").size).toBe(0);
    });

    it("returns an empty map on unrecognizable input", () => {
      expect(parseHeader("not valid at all!!").size).toBe(0);
    });
  });

  describe("bare token values", () => {
    it("parses `feature=*` as a wildcard allowlist", () => {
      const policy = parseHeader("publickey-credentials-get=*");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)).toEqual({
        feature: WebAuthnPermissionsPolicyFeature.Get,
        allowlist: [{ type: "wildcard" }],
      });
    });

    it("parses `feature=self` as a self allowlist", () => {
      const policy = parseHeader("publickey-credentials-get=self");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "self" },
      ]);
    });
  });

  describe("bare string values", () => {
    it('parses `feature="https://x"` as an origin allowlist', () => {
      const policy = parseHeader('publickey-credentials-get="https://allowed.example"');

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: "https://allowed.example" },
      ]);
    });

    it("normalizes origin strings via URL parsing", () => {
      const policy = parseHeader('publickey-credentials-get="HTTPS://Allowed.Example/path"');

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: "https://allowed.example" },
      ]);
    });

    it("handles backslash-escaped quotes and backslashes in strings", () => {
      // `"\""` decodes to `"`, which isn't a valid origin. The whole
      // directive is dropped so spec defaults apply — exercises the
      // string-escape path and the "unparseable bare item drops directive"
      // rule together.
      const policy = parseHeader('publickey-credentials-get="\\""');
      expect(policy.has(WebAuthnPermissionsPolicyFeature.Get)).toBe(false);
    });
  });

  describe("inner-list values", () => {
    it("parses an empty inner-list `()` as an empty (deny) allowlist", () => {
      const policy = parseHeader("publickey-credentials-get=()");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([]);
    });

    it("parses a single-item inner-list", () => {
      const policy = parseHeader('publickey-credentials-get=("https://one.example")');

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: "https://one.example" },
      ]);
    });

    it("parses a multi-item inner-list mixing tokens and strings", () => {
      const policy = parseHeader(
        'publickey-credentials-get=(self "https://one.example" "https://two.example")',
      );

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "self" },
        { type: "origin", value: "https://one.example" },
        { type: "origin", value: "https://two.example" },
      ]);
    });
  });

  describe("multiple directives", () => {
    it("parses comma-separated directives", () => {
      const policy = parseHeader("publickey-credentials-create=(), publickey-credentials-get=*");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Create)?.allowlist).toEqual([]);
      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "wildcard" },
      ]);
    });

    it("applies later-wins on duplicate features", () => {
      const policy = parseHeader(
        'publickey-credentials-get=(), publickey-credentials-get=("https://later.example")',
      );

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: "https://later.example" },
      ]);
    });

    it("tolerates extra whitespace and tabs around separators", () => {
      const policy = parseHeader(
        "  publickey-credentials-create=self ,\tpublickey-credentials-get=(self)  ",
      );

      expect(policy.size).toBe(2);
      expect(policy.get(WebAuthnPermissionsPolicyFeature.Create)?.allowlist).toEqual([
        { type: "self" },
      ]);
    });
  });

  describe("parameters (ignored but must not break parsing)", () => {
    it("skips parameters attached to inner-list items", () => {
      const policy = parseHeader(
        'publickey-credentials-get=("https://x.example";weight=1 "https://y.example")',
      );

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "origin", value: "https://x.example" },
        { type: "origin", value: "https://y.example" },
      ]);
    });

    it("skips parameters attached to the whole directive", () => {
      const policy = parseHeader("publickey-credentials-get=*;foo=1");

      expect(policy.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
        { type: "wildcard" },
      ]);
    });
  });

  describe("values we can't act on (drops directive silently)", () => {
    it("drops directives with integer values", () => {
      const policy = parseHeader("publickey-credentials-get=1");
      expect(policy.has(WebAuthnPermissionsPolicyFeature.Get)).toBe(false);
    });

    it("drops directives with boolean values", () => {
      const policy = parseHeader("publickey-credentials-get=?1");
      expect(policy.has(WebAuthnPermissionsPolicyFeature.Get)).toBe(false);
    });

    it("drops directives with no `=value` (bare booleans)", () => {
      const policy = parseHeader("publickey-credentials-get");
      expect(policy.has(WebAuthnPermissionsPolicyFeature.Get)).toBe(false);
    });

    it("does not affect parsing of neighboring directives", () => {
      const policy = parseHeader("publickey-credentials-get=?1, publickey-credentials-create=*");
      expect(policy.has(WebAuthnPermissionsPolicyFeature.Get)).toBe(false);
      expect(policy.get(WebAuthnPermissionsPolicyFeature.Create)?.allowlist).toEqual([
        { type: "wildcard" },
      ]);
    });
  });

  describe("failure modes", () => {
    it("returns an empty map when an inner-list is unterminated", () => {
      expect(parseHeader('publickey-credentials-get=("https://x.example"').size).toBe(0);
    });

    it("returns an empty map when a string is unterminated", () => {
      expect(parseHeader('publickey-credentials-get="not-closed').size).toBe(0);
    });

    it("returns an empty map on a trailing comma", () => {
      expect(parseHeader("publickey-credentials-get=*, ").size).toBe(0);
    });
  });

  describe("rejects top-level non-dictionary input", () => {
    // `Permissions-Policy` is defined as an sf-dictionary (RFC 8941 §4.2.2).
    // If the input at the top level can't be interpreted as a dictionary at
    // all, our parser must return an empty map so the resolver falls back to
    // spec defaults. These tests document that guarantee — combined with the
    // dictionary-conformance suite (all 26 WG dictionary tests), they replace
    // the need to run the WG list / item / token / string / boolean suites,
    // whose surface area our parser deliberately never traverses.

    it("rejects a bare integer at the top level", () => {
      expect(parseHeader("42").size).toBe(0);
    });

    it("rejects a bare decimal at the top level", () => {
      expect(parseHeader("1.5").size).toBe(0);
    });

    it("rejects a bare quoted string at the top level", () => {
      expect(parseHeader('"hello"').size).toBe(0);
    });

    it("rejects a bare inner-list at the top level", () => {
      expect(parseHeader("(a b c)").size).toBe(0);
    });

    it("rejects a bare boolean at the top level", () => {
      expect(parseHeader("?1").size).toBe(0);
      expect(parseHeader("?0").size).toBe(0);
    });

    it("rejects a bare byte-sequence at the top level", () => {
      expect(parseHeader(":dGVzdA==:").size).toBe(0);
    });

    it("rejects a bare date at the top level (RFC 9651)", () => {
      expect(parseHeader("@1659578233").size).toBe(0);
    });
  });
});
