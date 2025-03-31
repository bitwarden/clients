import { CollectionWithIdRequest } from "@bitwarden/admin-console/common";

import { CipherRequest } from "../../vault/models/request/cipher.request";

import { KvpRequest } from "./kvp.request";

export class ImportOrganizationCiphersRequest {
  ciphers: CipherRequest[] = [];
  collections: CollectionWithIdRequest[] = [];
  collectionRelationships: KvpRequest<number, number>[] = [];
}
