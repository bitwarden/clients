import { map, Observable } from "rxjs";

import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/legacy-crypto";

import { KdfConfigService } from "./abstractions/kdf-config.service";

export class DefaultKdfConfigService implements KdfConfigService {
  constructor(private masterPasswordService: InternalMasterPasswordServiceAbstraction) {}

  getKdfConfig$(userId: UserId): Observable<KdfConfig | null> {
    if (userId == null) {
      throw new Error("userId cannot be null");
    }

    return this.masterPasswordService
      .masterPasswordUnlockData$(userId)
      .pipe(map((unlockData) => unlockData?.kdf ?? null));
  }
}
