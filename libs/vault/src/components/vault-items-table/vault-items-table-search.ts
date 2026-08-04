import { inject, Signal } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, debounceTime, distinctUntilChanged, filter, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { SearchTextDebounceInterval } from "@bitwarden/common/vault/services/search.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

/**
 * The ids of the ciphers matching the active search term, or `undefined` when no searchable term is
 * active — in which case every row passes.
 */
export type CipherSearchMatches = Set<string> | undefined;

/**
 * Resolves {@link SearchService} matches for a live search term into a signal of matching cipher
 * ids, so a synchronous per-row predicate can consult an asynchronous, set-based search.
 *
 * `bit-table-v2` filters through one synchronous `(row, values) => boolean`, but a search term
 * can't be answered that way: `searchCiphers` is asynchronous (a `>`-prefixed query builds a lunr
 * index) and takes the whole row set at once. Bridging them here means the search runs once per
 * (ciphers, term) pair and the predicate degrades to a set lookup — which matters because the
 * table re-runs that predicate over every row once per filter-chip option to compute its faceted
 * counts, on every keystroke.
 *
 * Matches are keyed by id rather than by object identity: `cipherListViews$` re-decrypts on any
 * vault change and hands back a fresh object for every cipher, so identity-keyed matches would
 * drop every row for a tick after any edit or sync while a search was active. Keyed by id, only a
 * genuinely new cipher is briefly excluded, and the pipeline re-resolves for it immediately.
 *
 * A `>` query comes back in lunr's relevance order. That ordering is discarded — the rows keep the
 * order `ciphers` supplied them in, and the table's own sort (the Name column declares
 * `defaultSort`) decides what the user sees.
 *
 * Must be called from an injection context, e.g. a component field initializer.
 *
 * @param ciphers - The unfiltered rows to search.
 * @param term - The live search term, undebounced — `bit-search` updates it per keystroke.
 * @param organizationId - Scopes the lunr index for admin-console callers; unset elsewhere.
 */
export function cipherSearchMatches<C extends CipherViewLike>(
  ciphers: Signal<C[]>,
  term: Signal<string>,
  organizationId: Signal<OrganizationId | undefined>,
): Signal<CipherSearchMatches> {
  const searchService = inject(SearchService);
  const accountService = inject(AccountService);

  // A transient null account (an account switch) is dropped rather than mapped, so the last
  // resolved matches stand — `getUserId` would instead throw and leave the pipeline dead for the
  // rest of the table's lifetime.
  const userId$ = accountService.activeAccount$.pipe(
    getOptionalUserId,
    filter((userId): userId is UserId => userId != null),
  );

  const matches$ = combineLatest([
    toObservable(ciphers),
    // Debounced on the term alone: a vault change has to re-search promptly, not re-debounce.
    toObservable(term).pipe(debounceTime(SearchTextDebounceInterval), distinctUntilChanged()),
    toObservable(organizationId),
    userId$,
  ]).pipe(
    // `switchMap` so a newer keystroke abandons the search already in flight for the previous one.
    switchMap(async ([rows, searchTerm, organization, userId]) => {
      // Below the searchable minimum length (locale-dependent) there is no active search, matching
      // how every client gates its own search today.
      if (!(await searchService.isSearchable(searchTerm))) {
        return undefined;
      }
      const results = await searchService.searchCiphers(
        userId,
        organization ?? null,
        searchTerm,
        rows,
      );
      return new Set(results.map((cipher) => String(cipher.id)));
    }),
  );

  return toSignal(matches$, { initialValue: undefined });
}
