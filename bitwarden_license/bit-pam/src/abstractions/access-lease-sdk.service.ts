import { UserId } from "@bitwarden/common/types/guid";
import type { CipherView as SdkCipherView } from "@bitwarden/sdk-internal";

import type {
  AccessLeaseExtensionRequest,
  AccessLeaseId,
  AccessLeaseRevokeRequest,
  AccessLeaseView,
  AccessRequestView,
} from "./access-lease";

/**
 * The caller's own leases. Errors surface as the SDK's flat `LeasingError`, not `ErrorResponse`.
 */
export abstract class AccessLeaseSdkService {
  /** Defaults to the active user. */
  abstract listMyLeases(userId?: UserId): Promise<AccessLeaseView[]>;
  abstract extendLease(
    id: AccessLeaseId,
    request: AccessLeaseExtensionRequest,
  ): Promise<AccessRequestView>;
  abstract endLease(id: AccessLeaseId, request: AccessLeaseRevokeRequest): Promise<void>;
  /**
   * The full view of a cipher the caller holds a live lease on, or `undefined` without one. Never
   * stored.
   */
  abstract leasedCipher(cipherId: string): Promise<SdkCipherView | undefined>;
}
