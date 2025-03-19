// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { SendView } from "../tools/send/models/view/send.view";
import { IndexedEntityId, UserId } from "../types/guid";
import { CipherView } from "../vault/models/view/cipher.view";

export abstract class SearchService {
  indexedEntityId$: (userId: UserId) => Observable<IndexedEntityId | null>;

  clearIndex: (userId: UserId) => Promise<void>;
  isSearchable: (userId: UserId, query: string) => Promise<boolean>;
  indexCiphers: (
    userId: UserId,
    ciphersToIndex: CipherView[],
    indexedEntityGuid?: string,
  ) => Promise<void>;
  searchCiphers: (
    userId: UserId,
    query: string,
    filter?: ((cipher: CipherView) => boolean) | ((cipher: CipherView) => boolean)[],
    ciphers?: CipherView[],
  ) => Promise<CipherView[]>;
  searchCiphersBasic: (ciphers: CipherView[], query: string, deleted?: boolean) => CipherView[];
  searchSends: (sends: SendView[], query: string) => SendView[];
}
