import {
  allowlistMatches,
  getEffectiveAllowlist,
  isFeatureAllowedByPolicy,
} from "./permissions-policy-semantics";
import {
  AllowlistItem,
  PermissionsPolicyDirective,
  WebAuthnPermissionsPolicyFeature,
} from "./types";

const REQUESTING_ORIGIN = "https://example.com";
const OTHER_ORIGIN = "https://other.example";

function policyOf(...directives: PermissionsPolicyDirective[]) {
  return new Map(directives.map((d) => [d.feature, d]));
}

describe("isFeatureAllowedByPolicy", () => {
  describe("default allowlist (directive absent)", () => {
    it("permits the feature when the requesting origin is the policy-defining document", () => {
      const policy = policyOf();

      expect(
        isFeatureAllowedByPolicy(
          policy,
          WebAuthnPermissionsPolicyFeature.Create,
          REQUESTING_ORIGIN,
        ),
      ).toBe(true);
    });
  });

  describe("directive with empty allowlist", () => {
    it("denies the feature", () => {
      const policy = policyOf({
        feature: WebAuthnPermissionsPolicyFeature.Get,
        allowlist: [],
      });

      expect(
        isFeatureAllowedByPolicy(policy, WebAuthnPermissionsPolicyFeature.Get, REQUESTING_ORIGIN),
      ).toBe(false);
    });

    it("only denies the named feature — other features fall back to the default allowlist", () => {
      const policy = policyOf({
        feature: WebAuthnPermissionsPolicyFeature.Get,
        allowlist: [],
      });

      expect(
        isFeatureAllowedByPolicy(
          policy,
          WebAuthnPermissionsPolicyFeature.Create,
          REQUESTING_ORIGIN,
        ),
      ).toBe(true);
    });
  });

  describe("directive with wildcard allowlist", () => {
    it("permits any origin", () => {
      const policy = policyOf({
        feature: WebAuthnPermissionsPolicyFeature.Get,
        allowlist: [{ type: "wildcard" }],
      });

      expect(
        isFeatureAllowedByPolicy(policy, WebAuthnPermissionsPolicyFeature.Get, REQUESTING_ORIGIN),
      ).toBe(true);
      expect(
        isFeatureAllowedByPolicy(policy, WebAuthnPermissionsPolicyFeature.Get, OTHER_ORIGIN),
      ).toBe(true);
    });
  });

  describe("directive with self allowlist", () => {
    it("permits the requesting origin (which is also the policy-defining document)", () => {
      const policy = policyOf({
        feature: WebAuthnPermissionsPolicyFeature.Get,
        allowlist: [{ type: "self" }],
      });

      expect(
        isFeatureAllowedByPolicy(policy, WebAuthnPermissionsPolicyFeature.Get, REQUESTING_ORIGIN),
      ).toBe(true);
    });
  });

  describe("directive with explicit origin allowlist", () => {
    it("permits the requesting origin when it matches", () => {
      const policy = policyOf({
        feature: WebAuthnPermissionsPolicyFeature.Get,
        allowlist: [{ type: "origin", value: REQUESTING_ORIGIN }],
      });

      expect(
        isFeatureAllowedByPolicy(policy, WebAuthnPermissionsPolicyFeature.Get, REQUESTING_ORIGIN),
      ).toBe(true);
    });

    it("denies the requesting origin when it doesn't match", () => {
      const policy = policyOf({
        feature: WebAuthnPermissionsPolicyFeature.Get,
        allowlist: [{ type: "origin", value: OTHER_ORIGIN }],
      });

      expect(
        isFeatureAllowedByPolicy(policy, WebAuthnPermissionsPolicyFeature.Get, REQUESTING_ORIGIN),
      ).toBe(false);
    });
  });

  describe("multi-item allowlists", () => {
    it("permits when any one item matches", () => {
      const policy = policyOf({
        feature: WebAuthnPermissionsPolicyFeature.Get,
        allowlist: [{ type: "origin", value: OTHER_ORIGIN }, { type: "self" }],
      });

      expect(
        isFeatureAllowedByPolicy(policy, WebAuthnPermissionsPolicyFeature.Get, REQUESTING_ORIGIN),
      ).toBe(true);
    });

    it("denies when no item matches", () => {
      const policy = policyOf({
        feature: WebAuthnPermissionsPolicyFeature.Get,
        allowlist: [
          { type: "origin", value: OTHER_ORIGIN },
          { type: "origin", value: "https://another.example" },
        ],
      });

      expect(
        isFeatureAllowedByPolicy(policy, WebAuthnPermissionsPolicyFeature.Get, REQUESTING_ORIGIN),
      ).toBe(false);
    });
  });
});

describe("getEffectiveAllowlist", () => {
  it("returns the directive's allowlist when present", () => {
    const allowlist: AllowlistItem[] = [{ type: "self" }, { type: "origin", value: OTHER_ORIGIN }];
    const policy = policyOf({
      feature: WebAuthnPermissionsPolicyFeature.Create,
      allowlist,
    });

    expect(getEffectiveAllowlist(policy, WebAuthnPermissionsPolicyFeature.Create)).toEqual(
      allowlist,
    );
  });

  it("returns the default `self`-only allowlist when the directive is absent", () => {
    const policy = policyOf();

    expect(getEffectiveAllowlist(policy, WebAuthnPermissionsPolicyFeature.Create)).toEqual([
      { type: "self" },
    ]);
  });

  it("returns an empty allowlist when the directive denies the feature", () => {
    const policy = policyOf({
      feature: WebAuthnPermissionsPolicyFeature.Get,
      allowlist: [],
    });

    expect(getEffectiveAllowlist(policy, WebAuthnPermissionsPolicyFeature.Get)).toEqual([]);
  });
});

describe("allowlistMatches", () => {
  it("denies on an empty allowlist", () => {
    expect(allowlistMatches([], REQUESTING_ORIGIN)).toBe(false);
  });

  it("permits on a wildcard", () => {
    expect(allowlistMatches([{ type: "wildcard" }], REQUESTING_ORIGIN)).toBe(true);
  });

  it("permits on a self token", () => {
    expect(allowlistMatches([{ type: "self" }], REQUESTING_ORIGIN)).toBe(true);
  });

  it("permits on an exact-origin match", () => {
    expect(
      allowlistMatches([{ type: "origin", value: REQUESTING_ORIGIN }], REQUESTING_ORIGIN),
    ).toBe(true);
  });

  it("denies on an origin mismatch", () => {
    expect(allowlistMatches([{ type: "origin", value: OTHER_ORIGIN }], REQUESTING_ORIGIN)).toBe(
      false,
    );
  });

  it("matches case-sensitively on origin (parser is expected to pre-normalize)", () => {
    // The Permissions Policy spec requires origins in the allowlist to be ASCII
    // origin serializations. Browsers normalize via URL parsing, which lowercases
    // the scheme and host. Our semantics layer assumes that work is already done
    // by the parser, so we compare with strict string equality.
    expect(
      allowlistMatches([{ type: "origin", value: "https://Example.com" }], REQUESTING_ORIGIN),
    ).toBe(false);
  });
});
