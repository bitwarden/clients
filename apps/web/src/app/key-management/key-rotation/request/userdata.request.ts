import { ConnectedAppWithIdRequest } from "@bitwarden/common/tools/connected-app/models/request/connected-app-with-id.request";
import { SendWithIdRequest } from "@bitwarden/common/tools/send/models/request/send-with-id.request";
import { CipherWithIdRequest } from "@bitwarden/common/vault/models/request/cipher-with-id.request";
import { FolderWithIdRequest } from "@bitwarden/common/vault/models/request/folder-with-id.request";

export class UserDataRequest {
  ciphers: CipherWithIdRequest[];
  folders: FolderWithIdRequest[];
  sends: SendWithIdRequest[];
  connectedApps: ConnectedAppWithIdRequest[];

  constructor(
    ciphers: CipherWithIdRequest[],
    folders: FolderWithIdRequest[],
    sends: SendWithIdRequest[],
    connectedApps: ConnectedAppWithIdRequest[] = [],
  ) {
    this.ciphers = ciphers;
    this.folders = folders;
    this.sends = sends;
    this.connectedApps = connectedApps;
  }
}
