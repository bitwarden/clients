import { Observable } from "rxjs";

import { UserId } from "../../types/guid";
import { KdfConfig } from "../models/domain/kdf-config";

export abstract class KdfConfigService {
  abstract setKdfConfig(userId: UserId, KdfConfig: KdfConfig): Promise<void>;
  abstract getKdfConfig(): Promise<KdfConfig>;
  abstract getKdfConfig$(userId: UserId): Observable<KdfConfig>;
}
