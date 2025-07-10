// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionWithIdRequest } from "@bitwarden/admin-console/common";

import { CipherRequest } from "../../vault/models/request/cipher.request";

import { KvpRequest } from "./kvp.request";

export class ImportOrganizationCiphersRequest {
  ciphers: CipherRequest[] = [];
  collections: CollectionWithIdRequest[] = [];
  collectionRelationships: KvpRequest<number, number>[] = [];
}
