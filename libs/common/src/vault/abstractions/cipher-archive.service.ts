import { Observable } from "rxjs";

import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

export abstract class CipherArchiveService {
  abstract archivedCiphers$(userId: UserId): Observable<CipherViewLike[]>;
  abstract userCanArchive$(userId: UserId): Observable<boolean>;
  abstract showArchiveFeatures$(): Observable<boolean>;
  abstract userHasPremium$(userId: UserId): Observable<boolean>;
  abstract archiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<void>;
  abstract unarchiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<void>;
}
