import { Observable } from "rxjs";

import { SendView } from "../../tools/send/models/view/send.view";
import { OrganizationId, UserId } from "../../types/guid";
import { CipherViewLike } from "../utils/cipher-view-like-utils";

export abstract class SearchService {
  abstract isCipherSearching$: Observable<boolean>;
  abstract isSendSearching$: Observable<boolean>;

  /**
   * Checks if the query is long enough to be searchable.
   */
  abstract isSearchable(query: string | null): Promise<boolean>;
  /**
   * Searches the passed in ciphers. The user-id must always be provided.
   * If searching via the admin-console, the organization-id must also be provided.
   * The cipher-service may internally cache the search index for advanced lunr queries.
   *
   * Search will by default match the query to be a substring of the cipher's fields. If
   * the query starts with ">", then lunr search syntax will be used. The first time
   * a lunr query is run for any given set of ciphers, the search service will build
   * a lunr index which may take a few hundred milliseconds for large vaults. Subsequent
   * lunr queries will reuse the same index as long as the ciphers have not changed.
   */
  abstract searchCiphers<C extends CipherViewLike>(
    userId: UserId,
    organizationId: OrganizationId | null,
    query: string,
    ciphers: C[],
  ): Promise<C[]>;
  /**
   * Searches the passed in ciphers using basic substring matching.
   */
  abstract searchCiphersBasic<C extends CipherViewLike>(ciphers: C[], query: string): C[];
  abstract searchSends(sends: SendView[], query: string): SendView[];
}
