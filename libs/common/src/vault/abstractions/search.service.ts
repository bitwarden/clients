import { Observable } from "rxjs";

import { SendView } from "../../tools/send/models/view/send.view";
import { UserId } from "../../types/guid";
import { CipherViewLike } from "../utils/cipher-view-like-utils";

export abstract class SearchService {
  abstract isCipherSearching$: Observable<boolean>;
  abstract isSendSearching$: Observable<boolean>;

  abstract ciphersUpdated(userId: UserId): Promise<void>;
  /**
   * Checks if the query is long enough to be searchable.
   */
  abstract isSearchable(userId: UserId, query: string | null): Promise<boolean>;
  abstract searchCiphers<C extends CipherViewLike>(
    userId: UserId,
    query: string,
    ciphers: C[],
  ): Promise<C[]>;
  abstract searchCiphersBasic<C extends CipherViewLike>(
    ciphers: C[],
    query: string,
    deleted?: boolean,
    archived?: boolean,
  ): C[];
  abstract searchSends(sends: SendView[], query: string): SendView[];
}
