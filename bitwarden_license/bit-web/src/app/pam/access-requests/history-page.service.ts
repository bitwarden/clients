import { DestroyRef, Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  BehaviorSubject,
  Observable,
  catchError,
  distinctUntilChanged,
  from,
  map,
  merge,
  of,
  switchMap,
  tap,
} from "rxjs";

import {
  AccessEventService,
  AccessRequestHistoryPage,
  AccessRequestHistoryQuery,
  ApprovalSdkService,
} from "@bitwarden/bit-pam";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AccessNameResolverService } from "./access-name-resolver.service";
import { MyAccessRequestRow, buildMyAccessRequestRows } from "./my-access-row";

/** A filter choice: the id the server filters by, and the text the option shows. */
export type HistoryFilterOption = { value: string; label: string };

/** One page of the History tab, with what its filters can offer. */
export type HistoryPageView = {
  rows: MyAccessRequestRow[];
  /** How many requests match the query, across all pages. */
  total: number;
  requesterOptions: HistoryFilterOption[];
  collectionOptions: HistoryFilterOption[];
  cipherById: Map<string, CipherView>;
};

type ReadResult = { page: HistoryPageView } | { error: unknown };

/**
 * Reads the History tab's current page from the server, which pages, filters and orders it. Reads
 * again when the query changes and on every access push. Provided on the tab, so nothing reads
 * while the tab is closed.
 */
@Injectable()
export class HistoryPageService {
  private readonly approvalApi = inject(ApprovalSdkService);
  private readonly nameResolver = inject(AccessNameResolverService);
  private readonly accessEvents = inject(AccessEventService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly query$ = new BehaviorSubject<AccessRequestHistoryQuery | null>(null);
  private readonly _page$ = new BehaviorSubject<HistoryPageView | null>(null);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);

  /** The latest page read; null until the first read lands. */
  readonly page$: Observable<HistoryPageView | null> = this._page$.asObservable();
  /** True while a read for a new query is in flight. A push's re-read keeps the page on screen. */
  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();

  constructor() {
    // A new query shows the loading state; a push re-reads the same page behind the one on screen.
    const newQueries = this.query$.pipe(
      distinctUntilChanged(sameQuery),
      map((query) => ({ query, fresh: true })),
    );
    const pushes = merge(
      this.accessEvents.accessChanged$(),
      this.accessEvents.approverInboxChanged$(),
    ).pipe(map(() => ({ query: this.query$.value, fresh: false })));
    merge(newQueries, pushes)
      .pipe(
        switchMap(({ query, fresh }) => {
          if (query == null) {
            return of(null);
          }
          if (fresh) {
            this._loading$.next(true);
          }
          return from(this.read(query)).pipe(
            catchError((error: unknown) => of<ReadResult>({ error })),
          );
        }),
        tap((result) => {
          if (result == null) {
            return;
          }
          if ("error" in result) {
            this._loadError$.next(result.error);
          } else {
            this._loadError$.next(null);
            this._page$.next(result.page);
          }
          this._loading$.next(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** Reads the page this query describes, unless it is the one already shown. */
  setQuery(query: AccessRequestHistoryQuery): void {
    this.query$.next(query);
  }

  private async read(query: AccessRequestHistoryQuery): Promise<ReadResult> {
    const page: AccessRequestHistoryPage = await this.approvalApi.listHistory(query);
    const collectionIds = page.collectionIds.map(uuidAsString);
    const names = await this.nameResolver.resolveNames(
      page.requests.map((request) => ({
        cipherId: uuidAsString(request.cipherId),
        collectionId: uuidAsString(request.collectionId),
      })),
    );
    return {
      page: {
        rows: buildMyAccessRequestRows(page.requests, names),
        total: page.total,
        requesterOptions: sortOptions(
          page.requesters.map((requester) => ({
            value: uuidAsString(requester.id),
            label: requester.name || requester.email || uuidAsString(requester.id),
          })),
        ),
        // Names resolve only alongside rows, and the options ignore the filters, so a page with no
        // rows keeps the last ones. A collection outside the caller's vault has no name to offer.
        collectionOptions:
          page.requests.length === 0
            ? (this._page$.value?.collectionOptions ?? [])
            : sortOptions(
                collectionIds.flatMap((id) => {
                  const label = names.collectionNameById.get(id);
                  return label == null ? [] : [{ value: id, label }];
                }),
              ),
        cipherById: names.cipherById,
      },
    };
  }
}

/** A query set again with the same content is not a new one. */
function sameQuery(
  a: AccessRequestHistoryQuery | null,
  b: AccessRequestHistoryQuery | null,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sortOptions(options: HistoryFilterOption[]): HistoryFilterOption[] {
  return options.sort((a, b) => a.label.localeCompare(b.label));
}
