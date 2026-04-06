import { CipherRequest } from "../../vault/models/request/cipher.request";
import { FolderWithIdRequest } from "../../vault/models/request/folder-with-id.request";

import { KvpRequest } from "./kvp.request";

export class ImportCiphersRequest {
  ciphers: CipherRequest[] = [];
  folders: FolderWithIdRequest[] = [];
  folderRelationships: KvpRequest<number, number>[] = [];
}
