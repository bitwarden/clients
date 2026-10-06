import type { agent_access } from "@bitwarden/desktop-napi";

import { AgentAccessGrantKey, AgentAccessOpenShellGrantKey } from "../models/agent-access-grant";

/**
 * Grant-key `signatureKind` used for peers with no valid code signature — unsigned binaries,
 * failed verification, or no signature info at all. Not one of napi's `SignatureKindData`
 * members: those describe *how* a signature was verified, and this is the deliberate fallback for
 * when none was. Keying on path means swapping the binary at that path invalidates the grant.
 */
export const PATH_SIGNATURE_KIND = "path";

/**
 * Best-effort exe path of the *attested* process: the resolved parent (the agent that spawned
 * `aac`) if the parent-chain walk succeeded, else the immediate peer (`aac` itself). Mirrors the
 * rule the Rust attestation module uses to decide what to verify a signature against
 * (agent-access-architecture.md, "Attestation model (W2a)").
 */
export function attestedExePath(localPeer: agent_access.LocalPeerInfoData): string | undefined {
  return localPeer.parent?.exePath ?? localPeer.exePath;
}

/**
 * Derives the grant-store key for a local request's attested peer. A signed-and-valid peer keys
 * on its code-signature identity; everything else — unsigned, verification failed, or no
 * signature info captured at all — keys on the canonical executable path, so a binary swap at
 * that path re-prompts instead of silently inheriting the old grant
 * (agent-access-architecture.md, "Grant store (W2b)").
 */
export function deriveAgentAccessAttestationKey(
  localPeer: agent_access.LocalPeerInfoData,
  openshell?: AgentAccessOpenShellGrantKey,
): AgentAccessGrantKey {
  const { signature } = localPeer;
  // For an OpenShell request (§M8.5) the attested process is aac's parent, the
  // `openshell-gateway` — the same parent-first rule as a plain local request, so this is the
  // attested gateway identity. The gateway-reported sandbox/provider ids are added on top, never
  // in place of it.
  const openshellPart =
    openshell == null
      ? {}
      : {
          openshell: {
            gatewayEndpoint: openshell.gatewayEndpoint,
            sandboxId: openshell.sandboxId,
            providerId: openshell.providerId,
          },
        };
  if (signature != null && signature.valid) {
    return {
      signatureKind: signature.kind,
      signatureIdentity: signature.identity,
      ...openshellPart,
    };
  }

  // `signature.identity` already falls back to the executable path for unsigned/invalid peers
  // (see `SignatureInfoData`'s docs), so prefer it when present; otherwise fall back to the
  // attested exe path directly.
  return {
    signatureKind: PATH_SIGNATURE_KIND,
    signatureIdentity: signature?.identity ?? attestedExePath(localPeer) ?? "",
    ...openshellPart,
  };
}

/**
 * Display name for the attested requester: the parent process's name when the parent-chain walk
 * resolved it (the actual agent that spawned `aac`), else the immediate peer's (`aac` itself).
 * Returns `undefined` when neither is available — callers apply their own localized fallback
 * (e.g. "Unknown application") rather than baking user-facing copy into this framework-agnostic
 * helper. Never self-reported by the requester: sourced entirely from the OS-verified
 * `LocalPeerInfoData` (agent-access-desktop-plan.md, "What is already correct" — requester
 * identity is never self-reported).
 */
export function deriveAgentAccessDisplayName(
  localPeer: agent_access.LocalPeerInfoData | undefined,
): string | undefined {
  const name = localPeer?.parent?.processName || localPeer?.processName;
  return name || undefined;
}
