import type { OpenShellProviderTarget, OpenShellRequestContext } from "../models/openshell";

interface PeerLike {
  exePath?: string;
  parent?: { exePath?: string };
  signature?: { kind?: string; identity?: string };
}

/**
 * The exact identity of an OpenShell resolve for coalescing (agent-access-architecture.md,
 * §M8.18): the account, the attested gateway, every gateway-reported field the approval dialog
 * shows (gateway, sandbox, provider, policy digest, Advisor flag) and the credential target set,
 * sorted so a reordered batch is the same request. Any difference — another sandbox, provider,
 * target, field or digest — is a different key and so a new dialog. The endpoints are covered by
 * the digest, which the service re-verifies against them before any carried decision is used.
 *
 * Returns `null` when the message lacks what a key needs; such a request never coalesces (and
 * the service then refuses it anyway). Holds ids and names only, never a value.
 */
export function openShellCoalescingKey(
  userId: string,
  message: Record<string, unknown>,
): string | null {
  const context = message.openshell as OpenShellRequestContext | undefined;
  const targets = message.providerTargets as OpenShellProviderTarget[] | undefined;
  const peer = message.localPeer as PeerLike | undefined;
  if (
    typeof userId !== "string" ||
    userId.length === 0 ||
    context == null ||
    typeof context !== "object" ||
    !Array.isArray(targets) ||
    targets.length === 0 ||
    peer?.parent == null ||
    peer.signature == null
  ) {
    return null;
  }
  const targetParts = targets
    .map((target) =>
      JSON.stringify([target?.credentialKey, target?.resourceType, target?.id, target?.field]),
    )
    .sort();
  return JSON.stringify([
    userId,
    peer.signature.kind ?? null,
    peer.signature.identity ?? null,
    peer.parent.exePath ?? null,
    context.gatewayName ?? null,
    context.gatewayEndpoint ?? null,
    context.sandboxId ?? null,
    context.sandboxName ?? null,
    context.sandboxImage ?? null,
    context.providerId ?? null,
    context.providerName ?? null,
    context.providerProfile ?? null,
    context.workspace ?? null,
    context.policyDigest ?? null,
    context.advisorEnabled ?? null,
    targetParts,
  ]);
}
