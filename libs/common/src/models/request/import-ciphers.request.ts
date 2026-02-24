import { CipherRequest } from "../../vault/models/request/cipher.request";
import { FolderRequest } from "../../vault/models/request/folder.request";

import { KvpRequest } from "./kvp.request";

export class ImportCiphersRequest {
  ciphers: CipherRequest[] = [];
  folders: FolderRequest[] = [];
  folderRelationships: KvpRequest<number, number>[] = [];
}
