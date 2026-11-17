import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/legacy-crypto";

export abstract class KdfConfigService {
  /**
   * Emits the user's master-password KDF config, or `null` if the user has no master-password
   * unlock data (e.g. TDE or passwordless SSO users).
   */
  abstract getKdfConfig$(userId: UserId): Observable<KdfConfig | null>;
}
