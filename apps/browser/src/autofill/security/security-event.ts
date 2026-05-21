/**
 * Security telemetry stub.
 *
 * Records that *some* policy decision rejected a message, alongside the minimum
 * context needed for triage — never the payload itself. PII-free by construction:
 * the function signature precludes passing arbitrary user-provided strings.
 *
 * Phase 1 implementation: `console.warn` gated on `globalThis.__SECURITY_LOG__`.
 * Future phases may replace the body with a real telemetry sink without changing
 * the call sites.
 */

export type SecurityEventReason =
  | "sender-class-rejected"
  | "command-not-allowlisted"
  | "schema-parse-failed"
  | "frame-secret-mismatch"
  | "nonce-replay"
  | "rate-limited"
  | "iframe-origin-mismatch"
  | "iframe-source-mismatch";

export interface SecurityEventContext {
  command?: string;
  senderClass?: string;
  tabId?: number;
}

declare global {
  var __SECURITY_LOG__: boolean | undefined;
}

const isLoggingEnabled = (): boolean => {
  // Resolve at call time so tests can flip the flag between cases.
  return globalThis.__SECURITY_LOG__ === true;
};

export function logSecurityEvent(
  reason: SecurityEventReason,
  context: SecurityEventContext = {},
): void {
  if (!isLoggingEnabled()) {
    return;
  }
  // eslint-disable-next-line no-console -- security-channel diagnostic, gated by build flag
  console.warn(
    `[autofill/security] ${reason}`,
    JSON.stringify({
      command: context.command,
      senderClass: context.senderClass,
      tabId: context.tabId,
    }),
  );
}
