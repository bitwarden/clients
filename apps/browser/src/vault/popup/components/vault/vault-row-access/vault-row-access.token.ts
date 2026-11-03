import { Observable } from "rxjs";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { SafeInjectionToken } from "@bitwarden/ui-common";

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

/**
 * What a popup vault row needs from a privileged-control host: each row's status and the actions
 * its overflow menu offers. The popup knows nothing of how access is requested or leased.
 */
export interface VaultRowAccess {
  /** The cipher's status, or `null` when privileged control does not govern it for this member. */
  status$(cipher: CipherViewLike): Observable<VaultRowAccessStatus | null>;
  requestAccess(cipher: CipherViewLike): Promise<void>;
  startAccess(cipher: CipherViewLike): Promise<void>;
  extendAccess(cipher: CipherViewLike): Promise<void>;
  endAccess(cipher: CipherViewLike): Promise<void>;
}

/** Optional host contribution for privileged-control rows. Unprovided, rows show no status. */
export const VAULT_ROW_ACCESS = new SafeInjectionToken<VaultRowAccess>("VaultRowAccess");
