import {
  allowlistMatches,
  getEffectiveAllowlist,
  isFeatureAllowedByPolicy,
  resolveSelfInPolicy,
} from "./permissions-policy-semantics";
import {
  ParsedPermissionsPolicy,
  PermissionsPolicyDirective,
  ResolvedAllowlistItem,
  ResolvedPermissionsPolicy,
  WebAuthnPermissionsPolicyFeature,
} from "./types";

const REQUESTING_ORIGIN = "https://example.com";
const OTHER_ORIGIN = "https://other.example";

// Builds a resolved policy — the shape consumed by isFeatureAllowedByPolicy,
// getEffectiveAllowlist, and allowlistMatches. The type system disallows
// `{ type: "self" }` items here; those are the parser's job to resolve.
function policyOf(
  ...directives: PermissionsPolicyDirective<ResolvedAllowlistItem>[]
): ResolvedPermissionsPolicy {
  return new Map(directives.map((d) => [d.feature, d]));
}

// Builds an unresolved policy — the shape consumed by resolveSelfInPolicy.
// This is where `{ type: "self" }` items are still allowed as inputs.
function unresolvedPolicyOf(...directives: PermissionsPolicyDirective[]): ParsedPermissionsPolicy {
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
        allowlist: [
          { type: "origin", value: OTHER_ORIGIN },
          { type: "origin", value: REQUESTING_ORIGIN },
        ],
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
    const allowlist: ResolvedAllowlistItem[] = [
      { type: "wildcard" },
      { type: "origin", value: OTHER_ORIGIN },
    ];
    const policy = policyOf({
      feature: WebAuthnPermissionsPolicyFeature.Create,
      allowlist,
    });

    expect(getEffectiveAllowlist(policy, WebAuthnPermissionsPolicyFeature.Create)).toEqual(
      allowlist,
    );
  });

  it("returns the default wildcard allowlist when the directive is absent (matches MDN for publickey-credentials-*)", () => {
    const policy = policyOf();

    expect(getEffectiveAllowlist(policy, WebAuthnPermissionsPolicyFeature.Create)).toEqual([
      { type: "wildcard" },
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

describe("resolveSelfInPolicy", () => {
  const OWNER_ORIGIN = "https://owner.example";

  it("replaces `{ type: 'self' }` items with the owner origin", () => {
    const policy = unresolvedPolicyOf({
      feature: WebAuthnPermissionsPolicyFeature.Get,
      allowlist: [{ type: "self" }],
    });

    const resolved = resolveSelfInPolicy(policy, OWNER_ORIGIN);

    expect(resolved.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
      { type: "origin", value: OWNER_ORIGIN },
    ]);
  });

  it("leaves wildcard items untouched", () => {
    const policy = unresolvedPolicyOf({
      feature: WebAuthnPermissionsPolicyFeature.Get,
      allowlist: [{ type: "wildcard" }],
    });

    const resolved = resolveSelfInPolicy(policy, OWNER_ORIGIN);

    expect(resolved.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
      { type: "wildcard" },
    ]);
  });

  it("leaves explicit origin items untouched", () => {
    const other = "https://other.example";
    const policy = unresolvedPolicyOf({
      feature: WebAuthnPermissionsPolicyFeature.Get,
      allowlist: [{ type: "origin", value: other }],
    });

    const resolved = resolveSelfInPolicy(policy, OWNER_ORIGIN);

    expect(resolved.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
      { type: "origin", value: other },
    ]);
  });

  it("resolves mixed allowlists item-by-item", () => {
    const other = "https://other.example";
    const policy = unresolvedPolicyOf({
      feature: WebAuthnPermissionsPolicyFeature.Get,
      allowlist: [
        { type: "self" },
        { type: "wildcard" },
        { type: "origin", value: other },
        { type: "self" },
      ],
    });

    const resolved = resolveSelfInPolicy(policy, OWNER_ORIGIN);

    expect(resolved.get(WebAuthnPermissionsPolicyFeature.Get)?.allowlist).toEqual([
      { type: "origin", value: OWNER_ORIGIN },
      { type: "wildcard" },
      { type: "origin", value: other },
      { type: "origin", value: OWNER_ORIGIN },
    ]);
  });

  it("returns an empty policy for empty input", () => {
    expect(resolveSelfInPolicy(unresolvedPolicyOf(), OWNER_ORIGIN).size).toBe(0);
  });
});
