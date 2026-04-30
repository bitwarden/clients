import { CipherRequest } from "../../vault/models/request/cipher.request";
import { FolderWithOptionalIdRequest } from "../../vault/models/request/folder-with-optional-id.request";

import { KvpRequest } from "./kvp.request";

export class ImportCiphersRequest {
  ciphers: CipherRequest[] = [];
  folders: FolderWithOptionalIdRequest[] = [];
  folderRelationships: KvpRequest<number, number>[] = [];
}
