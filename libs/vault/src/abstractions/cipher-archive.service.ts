import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

export abstract class CipherArchiveService {
  abstract userCanArchive(userId: UserId): Promise<boolean>;
  abstract archiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<void>;
  abstract unarchiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<void>;
  abstract canInteract(cipher: CipherView, ignoreDecryptionFailure?: boolean): Promise<boolean>;
}
