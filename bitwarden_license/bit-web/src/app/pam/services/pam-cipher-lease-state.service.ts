import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherLeaseStateService } from "@bitwarden/common/vault/abstractions/cipher-lease-state.service";

import { AccessRequestSdkService, liveActiveLease } from "..";

/** Reads the lease fresh on every write, so a lapsed or ended lease locks the cipher at once. */
export class PamCipherLeaseStateService implements CipherLeaseStateService {
  constructor(
    private accessRequestSdkService: AccessRequestSdkService,
    private logService: LogService,
  ) {}

  async hasActiveLease(cipherId: CipherId): Promise<boolean> {
    try {
      const state = await this.accessRequestSdkService.getCipherAccessState(cipherId);
      return liveActiveLease(state, Date.now()) != null;
    } catch (error: unknown) {
      this.logService.error(error);
      return false;
    }
  }
}
