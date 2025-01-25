import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { KdfConfig } from "../models/kdf-config";

export abstract class KdfConfigService {
  abstract setKdfConfig(userId: UserId, KdfConfig: KdfConfig): Promise<void>;
  abstract getKdfConfig(): Promise<KdfConfig>;
  abstract getKdfConfig$(userId: UserId): Observable<KdfConfig | null>;
}
