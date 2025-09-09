import { Observable } from "rxjs";

import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

export abstract class CipherArchiveService {
  abstract archivedCiphers$: Observable<CipherViewLike[]>;
  abstract userCanArchive$(userId: UserId): Observable<boolean>;
  abstract showArchiveVault$(): Observable<boolean>;
  abstract archiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<void>;
  abstract unarchiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<void>;
  abstract canInteract(cipher: CipherView): Promise<boolean>;
}
