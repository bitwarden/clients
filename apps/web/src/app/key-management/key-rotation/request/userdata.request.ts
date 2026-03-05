import { SendWithIdRequest } from "@bitwarden/common/tools/send/models/request/send-with-id.request";
import { CipherWithIdRequest } from "@bitwarden/common/vault/models/request/cipher-with-id.request";
import { FolderWithIdRequest } from "@bitwarden/common/vault/models/request/folder-with-id.request";

export class UserDataRequest {
  ciphers: CipherWithIdRequest[];
  folders: FolderWithIdRequest[];
  sends: SendWithIdRequest[];

  constructor(
    ciphers: CipherWithIdRequest[],
    folders: FolderWithIdRequest[],
    sends: SendWithIdRequest[],
  ) {
    this.ciphers = ciphers;
    this.folders = folders;
    this.sends = sends;
  }
}
