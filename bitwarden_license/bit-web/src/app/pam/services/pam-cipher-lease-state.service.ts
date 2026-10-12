import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherLeaseStateService } from "@bitwarden/common/vault/abstractions/cipher-lease-state.service";

import { AccessLeaseSdkService } from "..";

/**
 * Reads the caller's leases fresh on every write, so a lapsed or ended lease locks the cipher at
 * once. One read covers a whole bulk write, as the server's bulk write gate does.
 */
export class PamCipherLeaseStateService implements CipherLeaseStateService {
  constructor(
    private accessLeaseSdkService: AccessLeaseSdkService,
    private logService: LogService,
  ) {}

  async leasedCipherIds(cipherIds: CipherId[]): Promise<Set<CipherId>> {
    try {
      const leases = await this.accessLeaseSdkService.listMyLeases();
      const nowMs = Date.now();
      const leased = new Set(
        leases
          .filter((l) => l.status === "active" && Date.parse(l.notAfter) > nowMs)
          .map((l) => uuidAsString(l.cipherId)),
      );
      return new Set(cipherIds.filter((id) => leased.has(id)));
    } catch (error: unknown) {
      this.logService.error(error);
      return new Set();
    }
  }
}
