/**
 * Where a privileged-control item stands for the member, as a popup vault row shows it. `request`
 * and `unavailable` are gated, `pending` waits on an approver, `ready` is approved but not started
 * and `active` is a live lease.
 */
export type VaultRowAccessStatusKind = "request" | "pending" | "unavailable" | "ready" | "active";

export interface VaultRowAccessStatus {
  readonly kind: VaultRowAccessStatusKind;
  /** The localized status text, such as "Request to use" or "8h left". Ticks while active. */
  readonly label: string;
  /** Whether the live lease may be extended. Only meaningful while `active`. */
  readonly canExtend: boolean;
}
