import { FrameNode, isWebAuthnFeatureAllowedForFrame } from "./frame-policy-resolver";
import {
  PermissionsPolicyDirective,
  ResolvedAllowlistItem,
  ResolvedPermissionsPolicy,
  WebAuthnPermissionsPolicyFeature,
} from "./types";

const TOP_ORIGIN = "https://parent.example";
const CHILD_ORIGIN = "https://child.example";
const OTHER_ORIGIN = "https://other.example";

function policyOf(
  ...directives: PermissionsPolicyDirective<ResolvedAllowlistItem>[]
): ResolvedPermissionsPolicy {
  return new Map(directives.map((d) => [d.feature, d]));
}

function topFrame(declared: ResolvedPermissionsPolicy = policyOf()): FrameNode {
  return { origin: TOP_ORIGIN, declared, container: policyOf(), parent: null };
}

function childFrameOf(
  parent: FrameNode,
  declared: ResolvedPermissionsPolicy = policyOf(),
  container: ResolvedPermissionsPolicy = policyOf(),
  origin = CHILD_ORIGIN,
): FrameNode {
  return { origin, declared, container, parent };
}

describe("isWebAuthnFeatureAllowedForFrame", () => {
  describe("top-level frame", () => {
    it("permits the feature when no Permissions-Policy header was sent", () => {
      const frame = topFrame();

      expect(isWebAuthnFeatureAllowedForFrame(frame, WebAuthnPermissionsPolicyFeature.Get)).toBe(
        true,
      );
    });

    it("denies the feature when the document explicitly denies via empty allowlist (VULN-582 top-level)", () => {
      const frame = topFrame(
        policyOf({ feature: WebAuthnPermissionsPolicyFeature.Get, allowlist: [] }),
      );

      expect(isWebAuthnFeatureAllowedForFrame(frame, WebAuthnPermissionsPolicyFeature.Get)).toBe(
        false,
      );
    });

    it("denies one feature without affecting the other", () => {
      const frame = topFrame(
        policyOf({ feature: WebAuthnPermissionsPolicyFeature.Get, allowlist: [] }),
      );

      expect(isWebAuthnFeatureAllowedForFrame(frame, WebAuthnPermissionsPolicyFeature.Get)).toBe(
        false,
      );
      expect(isWebAuthnFeatureAllowedForFrame(frame, WebAuthnPermissionsPolicyFeature.Create)).toBe(
        true,
      );
    });
  });

  describe("same-origin iframe", () => {
    it("permits the feature by default (container default `self` matches parent's origin = iframe's origin)", () => {
      const sameOriginChild = childFrameOf(topFrame(), policyOf(), policyOf(), TOP_ORIGIN);

      expect(
        isWebAuthnFeatureAllowedForFrame(sameOriginChild, WebAuthnPermissionsPolicyFeature.Get),
      ).toBe(true);
    });

    it("inherits a parent's deny (VULN-582 same-origin iframe case)", () => {
      const parent = topFrame(
        policyOf({ feature: WebAuthnPermissionsPolicyFeature.Get, allowlist: [] }),
      );
      const sameOriginChild = childFrameOf(parent, policyOf(), policyOf(), TOP_ORIGIN);

      expect(
        isWebAuthnFeatureAllowedForFrame(sameOriginChild, WebAuthnPermissionsPolicyFeature.Get),
      ).toBe(false);
    });
  });

  describe("cross-origin iframe — VULN-398 / VULN-582 territory", () => {
    it("denies when the iframe has no `allow=` attribute for the feature (VULN-398 primary case)", () => {
      const crossOriginChild = childFrameOf(topFrame());

      expect(
        isWebAuthnFeatureAllowedForFrame(crossOriginChild, WebAuthnPermissionsPolicyFeature.Get),
      ).toBe(false);
    });

    it("permits when the iframe's `allow=` delegates the feature to its own origin", () => {
      const crossOriginChild = childFrameOf(
        topFrame(),
        policyOf(),
        // Parser resolves `'src'` (or the bare `allow="feature"` form) to the
        // iframe's own origin before this layer sees it.
        policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Get,
          allowlist: [{ type: "origin", value: CHILD_ORIGIN }],
        }),
      );

      expect(
        isWebAuthnFeatureAllowedForFrame(crossOriginChild, WebAuthnPermissionsPolicyFeature.Get),
      ).toBe(true);
    });

    it("permits when `allow=` uses `*` (wildcard delegation)", () => {
      const crossOriginChild = childFrameOf(
        topFrame(),
        policyOf(),
        policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Get,
          allowlist: [{ type: "wildcard" }],
        }),
      );

      expect(
        isWebAuthnFeatureAllowedForFrame(crossOriginChild, WebAuthnPermissionsPolicyFeature.Get),
      ).toBe(true);
    });

    it("denies when `allow=` delegates to a different origin than the iframe's", () => {
      const crossOriginChild = childFrameOf(
        topFrame(),
        policyOf(),
        policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Get,
          allowlist: [{ type: "origin", value: OTHER_ORIGIN }],
        }),
      );

      expect(
        isWebAuthnFeatureAllowedForFrame(crossOriginChild, WebAuthnPermissionsPolicyFeature.Get),
      ).toBe(false);
    });

    it("denies even with `allow=` when the parent explicitly denies the feature (VULN-582 cross-origin case)", () => {
      const parent = topFrame(
        policyOf({ feature: WebAuthnPermissionsPolicyFeature.Get, allowlist: [] }),
      );
      const crossOriginChild = childFrameOf(
        parent,
        policyOf(),
        policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Get,
          allowlist: [{ type: "origin", value: CHILD_ORIGIN }],
        }),
      );

      expect(
        isWebAuthnFeatureAllowedForFrame(crossOriginChild, WebAuthnPermissionsPolicyFeature.Get),
      ).toBe(false);
    });

    it("permits the partial-deny case for the still-allowed feature", () => {
      // Parent denies get, but not create. Cross-origin iframe with allow=
      // for create only. Create should be allowed (parent doesn't deny it,
      // iframe explicitly delegated). Get should be denied.
      const parent = topFrame(
        policyOf({ feature: WebAuthnPermissionsPolicyFeature.Get, allowlist: [] }),
      );
      const crossOriginChild = childFrameOf(
        parent,
        policyOf(),
        policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Create,
          allowlist: [{ type: "origin", value: CHILD_ORIGIN }],
        }),
      );

      expect(
        isWebAuthnFeatureAllowedForFrame(crossOriginChild, WebAuthnPermissionsPolicyFeature.Create),
      ).toBe(true);
      expect(
        isWebAuthnFeatureAllowedForFrame(crossOriginChild, WebAuthnPermissionsPolicyFeature.Get),
      ).toBe(false);
    });

    it("denies when the iframe's own response header denies the feature, regardless of `allow=`", () => {
      const crossOriginChild = childFrameOf(
        topFrame(),
        policyOf({ feature: WebAuthnPermissionsPolicyFeature.Get, allowlist: [] }),
        policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Get,
          allowlist: [{ type: "origin", value: CHILD_ORIGIN }],
        }),
      );

      expect(
        isWebAuthnFeatureAllowedForFrame(crossOriginChild, WebAuthnPermissionsPolicyFeature.Get),
      ).toBe(false);
    });
  });

  describe("nested iframes — deeper chains", () => {
    it("propagates the top-level frame's deny down through two levels of iframe", () => {
      const top = topFrame(
        policyOf({ feature: WebAuthnPermissionsPolicyFeature.Get, allowlist: [] }),
      );
      const middle = childFrameOf(
        top,
        policyOf(),
        policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Get,
          allowlist: [{ type: "origin", value: CHILD_ORIGIN }],
        }),
      );
      const innerOrigin = "https://inner.example";
      const inner = childFrameOf(
        middle,
        policyOf(),
        policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Get,
          allowlist: [{ type: "origin", value: innerOrigin }],
        }),
        innerOrigin,
      );

      expect(isWebAuthnFeatureAllowedForFrame(inner, WebAuthnPermissionsPolicyFeature.Get)).toBe(
        false,
      );
    });

    it("permits a nested iframe when each link delegates broadly enough to reach the inner origin", () => {
      // Top embeds middle with `allow="publickey-credentials-get *"` so middle
      // can re-delegate to any origin. Middle then embeds inner with
      // `allow="publickey-credentials-get"` (resolved to inner.origin). Inner
      // uses the feature at its own origin.
      const top = topFrame();
      const middle = childFrameOf(
        top,
        policyOf(),
        policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Get,
          allowlist: [{ type: "wildcard" }],
        }),
      );
      const innerOrigin = "https://inner.example";
      const inner = childFrameOf(
        middle,
        policyOf(),
        policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Get,
          allowlist: [{ type: "origin", value: innerOrigin }],
        }),
        innerOrigin,
      );

      expect(isWebAuthnFeatureAllowedForFrame(inner, WebAuthnPermissionsPolicyFeature.Get)).toBe(
        true,
      );
    });

    it("denies a nested iframe when the intermediate iframe was only delegated for its own origin (single-origin delegation does not transit)", () => {
      // This is the spec's "single-origin delegation" property: top's
      // `allow="publickey-credentials-get"` on middle's iframe resolves to
      // middle's own origin. Middle has the feature for itself, but can't
      // re-delegate to inner's origin because that origin isn't in middle's
      // effective allowlist.
      const top = topFrame();
      const middle = childFrameOf(
        top,
        policyOf(),
        policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Get,
          allowlist: [{ type: "origin", value: CHILD_ORIGIN }],
        }),
      );
      const innerOrigin = "https://inner.example";
      const inner = childFrameOf(
        middle,
        policyOf(),
        policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Get,
          allowlist: [{ type: "origin", value: innerOrigin }],
        }),
        innerOrigin,
      );

      expect(isWebAuthnFeatureAllowedForFrame(inner, WebAuthnPermissionsPolicyFeature.Get)).toBe(
        false,
      );
    });

    it("denies when an intermediate iframe lacks `allow=` for the feature", () => {
      const top = topFrame();
      // Middle iframe has no allow= for the feature → container default `self`
      // (= top's origin) doesn't match middle's origin (CHILD_ORIGIN) → denied.
      const middle = childFrameOf(top);
      const innerOrigin = "https://inner.example";
      const inner = childFrameOf(
        middle,
        policyOf(),
        policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Get,
          allowlist: [{ type: "origin", value: innerOrigin }],
        }),
        innerOrigin,
      );

      expect(isWebAuthnFeatureAllowedForFrame(inner, WebAuthnPermissionsPolicyFeature.Get)).toBe(
        false,
      );
    });
  });
});
