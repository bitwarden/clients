import { Observable } from "rxjs";

import { SendView } from "../../tools/send/models/view/send.view";
import { IndexedEntityId, UserId } from "../../types/guid";
import { CipherViewLike } from "../utils/cipher-view-like-utils";

export abstract class SearchService {
  abstract isCipherSearching$: Observable<boolean>;
  abstract isSendSearching$: Observable<boolean>;

  abstract indexedEntityId$(userId: UserId): Observable<IndexedEntityId | null>;

  abstract clearIndex(userId: UserId): Promise<void>;

  /**
   * Checks if the query is long enough to be searchable.
   */
  abstract isSearchable(userId: UserId, query: string | null): Promise<boolean>;
  /**
   * @param indexedEntityId - Optional identifier for the entity whose ciphers are being searched
   * (e.g. an organization ID when searching from the Admin Console). If this does not match the
   * entity ID of the currently cached Lunr index, the index will be cleared and rebuilt.
   * When omitted or undefined, the search is assumed to be for the user's personal vault.
   */
  abstract searchCiphers<C extends CipherViewLike>(
    userId: UserId,
    query: string,
    filter?: ((cipher: C) => boolean) | ((cipher: C) => boolean)[],
    ciphers?: C[],
    indexedEntityId?: IndexedEntityId,
  ): Promise<C[]>;
  abstract searchCiphersBasic<C extends CipherViewLike>(
    ciphers: C[],
    query: string,
    deleted?: boolean,
    archived?: boolean,
  ): C[];
  abstract searchSends(sends: SendView[], query: string): SendView[];
}
