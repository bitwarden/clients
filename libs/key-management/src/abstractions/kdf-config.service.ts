import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/legacy-crypto";

export abstract class KdfConfigService {
  abstract setKdfConfig(userId: UserId, KdfConfig: KdfConfig): Promise<void>;
  abstract getKdfConfig(userId: UserId): Promise<KdfConfig>;
  abstract getKdfConfig$(userId: UserId): Observable<KdfConfig | null>;
}
