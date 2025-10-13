import { Observable } from "rxjs";

import { SendView } from "../../tools/send/models/view/send.view";
import { IndexedEntityId, UserId } from "../../types/guid";
import { CipherView } from "../models/view/cipher.view";
import { CipherViewLike } from "../utils/cipher-view-like-utils";

export abstract class SearchService {
  abstract indexedEntityId$(userId: UserId): Observable<IndexedEntityId | null>;

  abstract clearIndex(userId: UserId): Promise<void>;

  /**
   * Checks if the query is long enough to be searchable.
   * For short Lunr.js queries (starts with '>'), a valid search index must exist for the user.
   */
  abstract isSearchable(userId: UserId, query: string | null): Promise<boolean>;
  abstract indexCiphers(
    userId: UserId,
    ciphersToIndex: CipherView[],
    indexedEntityGuid?: string,
  ): Promise<void>;
  abstract searchCiphers<C extends CipherViewLike>(
    userId: UserId,
    query: string,
    filter?: ((cipher: C) => boolean) | ((cipher: C) => boolean)[],
    ciphers?: C[],
  ): Promise<C[]>;
  abstract searchCiphersBasic<C extends CipherViewLike>(
    ciphers: C[],
    query: string,
    deleted?: boolean,
    archived?: boolean,
  ): C[];
  abstract searchSends(sends: SendView[], query: string): SendView[];
}
