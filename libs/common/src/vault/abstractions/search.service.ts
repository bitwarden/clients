// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { SendView } from "../../tools/send/models/view/send.view";
import { IndexedEntityId, UserId } from "../../types/guid";
import { CipherView } from "../models/view/cipher.view";
import { CipherViewLike } from "../utils/cipher-view-like-utils";

export abstract class SearchService {
  indexedEntityId$: (userId: UserId) => Observable<IndexedEntityId | null>;

  clearIndex: (userId: UserId) => Promise<void>;
  isSearchable: (userId: UserId, query: string) => Promise<boolean>;
  indexCiphers: (
    userId: UserId,
    ciphersToIndex: CipherView[],
    indexedEntityGuid?: string,
  ) => Promise<void>;
  searchCiphers: <C extends CipherViewLike>(
    userId: UserId,
    query: string,
    filter?: ((cipher: C) => boolean) | ((cipher: C) => boolean)[],
    ciphers?: C[],
  ) => Promise<C[]>;
  searchCiphersBasic: <C extends CipherViewLike>(
    ciphers: C[],
    query: string,
    deleted?: boolean,
  ) => C[];
  searchSends: (sends: SendView[], query: string) => SendView[];
}
