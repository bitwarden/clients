import { allowlistMatches, isFeatureAllowedByPolicy } from "./permissions-policy-semantics";
import { ResolvedPermissionsPolicy } from "./types";

/**
 * Frame-chain delegation algorithm for the Permissions Policy.
 *
 * Determines whether a feature is allowed in a given frame by walking from the
 * frame up to the top of the chain, combining:
 *   1. Each frame's declared policy (its own response headers, with defaults).
 *   2. The container policy at each iframe boundary (the parent's `allow=`
 *      attribute on the iframe element, with defaults).
 *
 * A feature is allowed for the frame iff:
 *   - The frame's declared policy permits its origin, AND
 *   - For every ancestor link in the chain:
 *     - The container policy at that link permits the frame's origin, AND
 *     - The ancestor's declared policy permits the frame's origin
 *       (this is how a parent's `Permissions-Policy: feature=()` denial
 *       propagates down to descendants — VULN-582's cross-origin iframe case).
 *
 * The default container policy (when `allow=` doesn't mention the feature) is
 * `self` — i.e. the iframe element's origin = the parent's origin. For
 * cross-origin iframes this fails to match the iframe's own origin, which is
 * what produces VULN-398's "cross-origin iframe without `allow=` is denied"
 * behavior.
 *
 * Inputs are pre-parsed by the parser layer (deferred to a separate step).
 * The parser is expected to:
 *   - Apply the spec's default allowlist when a declared directive is absent
 *     (handled by `isFeatureAllowedByPolicy` in the semantics layer).
 *   - Resolve `self`/`src` tokens in container policies to explicit origin
 *     strings, so this layer doesn't need to know about them.
 */

/**
 * One frame in the chain. `parent` is null for the top-level frame.
 *
 * - `origin`        — the frame's document origin (ASCII serialization).
 * - `declared`      — the parsed `Permissions-Policy` response header (or empty
 *                     Map when no header was received).
 * - `container`     — the parsed `allow=` attribute from the parent's iframe
 *                     element (or empty Map for the top-level frame, and for
 *                     sub-frames whose iframe element has no `allow=`).
 * - `parent`        — the FrameNode for the parent frame, or null at top level.
 */
export type FrameNode = {
  readonly origin: string;
  readonly declared: ResolvedPermissionsPolicy;
  readonly container: ResolvedPermissionsPolicy;
  readonly parent: FrameNode | null;
};

/**
 * Returns whether `feature` is allowed for `frame` per the Permissions Policy
 * delegation algorithm. Checks the frame's declared policy, then walks up the
 * chain checking container policies and ancestors' declared policies, all
 * evaluated against the frame's own origin.
 */
export function isWebAuthnFeatureAllowedForFrame(frame: FrameNode, feature: string): boolean {
  return isFeatureAllowedForOrigin(frame, feature, frame.origin);
}

function isFeatureAllowedForOrigin(frame: FrameNode, feature: string, origin: string): boolean {
  // Step 1: The frame's own declared policy must allow the requesting origin.
  // For the top frame this is "do my response headers permit me?"; for a
  // sub-frame this is the same question applied at each ancestor in turn.
  if (!isFeatureAllowedByPolicy(frame.declared, feature, origin)) {
    return false;
  }

  // Step 2: Top-level frame — no container, no further inheritance.
  if (frame.parent == null) {
    return true;
  }

  // Step 3: The iframe element's `allow=` attribute (container policy) must
  // permit the requesting origin. When the attribute doesn't mention the
  // feature, the container default is `self` = the iframe element's origin =
  // the parent's origin. This is what denies cross-origin iframes that didn't
  // receive an explicit delegation (VULN-398).
  if (!isContainerAllowed(frame, feature, origin)) {
    return false;
  }

  // Step 4: Recurse to the parent's effective policy — but still evaluating
  // for the **original** requesting origin, not the parent's. This is what
  // propagates a parent's deny to a child (VULN-582 in iframes).
  return isFeatureAllowedForOrigin(frame.parent, feature, origin);
}

function isContainerAllowed(frame: FrameNode, feature: string, origin: string): boolean {
  const containerDirective = frame.container.get(feature);
  if (containerDirective == null) {
    // Container default for `publickey-credentials-*` is `self` = the iframe
    // element's origin = the parent's origin. The non-null assertion is safe:
    // we never reach here for a top-level frame.
    return frame.parent!.origin === origin;
  }
  return allowlistMatches(containerDirective.allowlist, origin);
}
