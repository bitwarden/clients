import { AgentId } from "../models/agent-id";

/**
 * Maps an attested code-signature identity to the agent brand it belongs to, so the first-use
 * authorization dialog can show a recognizable logo and product name instead of a bare process
 * name. Renderer-safe (no Node imports), matching the rest of `models/` and `utils/`.
 *
 * The brand shown here is decoration on top of the identity the dialog already states in text; it
 * is never the thing the grant is keyed on (that is `deriveAgentAccessAttestationKey`). Two rules
 * keep it from becoming a forgeable trust signal:
 *
 *  1. **Only a verified signature resolves a brand.** Callers must gate on `signatureValid === true`
 *     (see `resolveAgentBrand`'s contract). An unsigned binary, a failed verification, or a
 *     Linux path-only descriptor gets the neutral fallback, never a logo.
 *  2. **macOS matches on the full `teamId:bundleId`, not the bundle id alone.** Apple issues team
 *     IDs, so a look-alike bundle id signed by anyone else does not match. A wrong guess here can
 *     only ever cost a missed logo, never a wrong one.
 */

interface AgentBrandMatcher {
  readonly id: AgentId;
  /**
   * Exact `{teamId}:{identifier}` strings as produced by `verify_signature` on macOS
   * (desktop_native/agent_access/src/attestation.rs). Compared case-insensitively.
   *
   * OBSERVED, not guessed — each entry below was read off a real installed binary with
   * `codesign -dv --verbose=4 <path>` and carries an Apple-issued Developer ID authority. To add
   * an agent, run that command against its binary and paste the `TeamIdentifier:Identifier` pair.
   * Agents with no entry simply fall back to the neutral glyph.
   */
  readonly macosIdentities: readonly string[];
  /**
   * Lowercased prefixes of the Authenticode publisher common name on Windows (the identity is the
   * bare CN — see the `#[cfg(windows)]` arm of `verify_signature`). Prefix rather than exact match
   * because the legal-suffix formatting of a CN varies ("Anthropic PBC" vs "Anthropic, PBC") in a
   * way the macOS team ID does not.
   *
   * Only vendors whose signing identity maps 1:1 onto a single agent are listed. Google and
   * Microsoft/GitHub are deliberately absent: both sign many unrelated products, so a CN prefix
   * match would attach the Gemini or Copilot logo to any of them.
   *
   * UNVERIFIED — no Windows binary was available to read a real CN from. A wrong prefix here
   * fails safe to the neutral glyph.
   */
  readonly windowsPublisherPrefixes: readonly string[];
}

const AGENT_BRAND_MATCHERS: readonly AgentBrandMatcher[] = Object.freeze([
  {
    id: AgentId.Claude,
    // Developer ID Application: Anthropic PBC (Q6L2SF6YDW)
    macosIdentities: ["Q6L2SF6YDW:com.anthropic.claude-code"],
    windowsPublisherPrefixes: ["anthropic"],
  },
  {
    id: AgentId.Codex,
    // Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2). The identifier really is the bare
    // `codex`, not a reverse-DNS bundle id: the CLI is a signed executable, not an app bundle.
    macosIdentities: ["2DC432GLL2:codex"],
    windowsPublisherPrefixes: ["openai"],
  },
  {
    id: AgentId.Cursor,
    macosIdentities: [],
    windowsPublisherPrefixes: ["anysphere"],
  },
  {
    id: AgentId.Gemini,
    macosIdentities: [],
    windowsPublisherPrefixes: [],
  },
  {
    id: AgentId.Copilot,
    macosIdentities: [],
    windowsPublisherPrefixes: [],
  },
]);

const MACOS_SIGNATURE_KIND = "macosTeamId";
const WINDOWS_SIGNATURE_KIND = "windowsPublisher";

export interface AgentBrandLookup {
  /** napi `SignatureKindData` member, or `undefined` when no signature info was captured. */
  signatureKind?: string;
  signatureIdentity?: string;
  signatureValid?: boolean;
}

/**
 * Resolves the agent brand behind a verified code signature, or `undefined` when the signature is
 * missing, invalid, or belongs to an application this registry does not recognize. Callers render
 * a neutral fallback for `undefined` rather than guessing.
 */
export function resolveAgentBrand(lookup: AgentBrandLookup): AgentId | undefined {
  if (lookup.signatureValid !== true) {
    return undefined;
  }

  const identity = lookup.signatureIdentity?.trim().toLowerCase();
  if (!identity) {
    return undefined;
  }

  const matched = AGENT_BRAND_MATCHERS.find((matcher) =>
    lookup.signatureKind === MACOS_SIGNATURE_KIND
      ? matcher.macosIdentities.some((candidate) => candidate.toLowerCase() === identity)
      : lookup.signatureKind === WINDOWS_SIGNATURE_KIND &&
        matcher.windowsPublisherPrefixes.some((prefix) => identity.startsWith(prefix)),
  );

  return matched?.id;
}
