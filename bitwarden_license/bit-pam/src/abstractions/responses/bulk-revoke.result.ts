/**
 * Result of an organization-wide kill-switch bulk revoke. Either all targeted
 * leases were revoked (`ok`) or some failed (`partial`) — the dashboard
 * surfaces the counts to the operator.
 */
export type BulkRevokeResult =
  | { kind: "ok"; revokedCount: number }
  | { kind: "partial"; revokedCount: number; failedCount: number };
