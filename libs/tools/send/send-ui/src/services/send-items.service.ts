import { Injectable } from "@angular/core";
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  from,
  map,
  merge,
  Observable,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  tap,
} from "rxjs";

import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";

import { SendListFiltersService } from "./send-list-filters.service";

/**
 * Service for managing the various item lists on the new Vault tab in the browser popup.
 */
@Injectable({
  providedIn: "root",
})
export class SendItemsService {
  private _searchText$ = new BehaviorSubject<string>("");

  /**
   * Subject that emits whenever new sends are being processed/filtered.
   * @private
   */
  private _sendsLoading$ = new Subject<void>();

  latestSearchText$: Observable<string> = this._searchText$.asObservable();
  private _sendList$: Observable<SendView[]> = this.sendService.sendViews$;

  /**
   * Observable that emits the list of sends, filtered and sorted based on the current search text and filters.
   * The list is sorted alphabetically by send name.
   * @readonly
   */
  filteredAndSortedSends$: Observable<SendView[]> = combineLatest([
    this._sendList$,
    this._searchText$,
    this.sendListFiltersService.filterFunction$,
  ]).pipe(
    tap(() => {
      this._sendsLoading$.next();
    }),
    map(([sends, searchText, filterFunction]): [SendView[], string] => [
      filterFunction(sends),
      searchText,
    ]),
    map(([sends, searchText]) => this.searchService.searchSends(sends, searchText)),
    map((sends) => sends.sort((a, b) => a.name.localeCompare(b.name))),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /**
   * Observable that indicates whether the service is currently loading sends.
   */
  loading$: Observable<boolean> = merge(
    this._sendsLoading$.pipe(map(() => true)),
    this.filteredAndSortedSends$.pipe(map(() => false)),
  ).pipe(startWith(true), distinctUntilChanged(), shareReplay({ refCount: false, bufferSize: 1 }));

  /**
   * Observable that indicates whether a filter is currently applied to the sends.
   */
  hasFilterApplied$ = combineLatest([this._searchText$, this.sendListFiltersService.filters$]).pipe(
    switchMap(([searchText, filters]) => {
      return from(this.searchService.isSearchable(searchText)).pipe(
        map(
          (isSearchable) =>
            isSearchable || Object.values(filters).some((filter) => filter !== null),
        ),
      );
    }),
  );

  /**
   * Observable that indicates whether the user's send list is empty.
   */
  emptyList$: Observable<boolean> = this._sendList$.pipe(map((sends) => !sends.length));

  /**
   * Observable that indicates whether there are no sends to show with the current filter.
   */
  noFilteredResults$: Observable<boolean> = this.filteredAndSortedSends$.pipe(
    map((sends) => !sends.length),
  );

  constructor(
    private sendService: SendService,
    private sendListFiltersService: SendListFiltersService,
    private searchService: SearchService,
  ) {}

  applyFilter(newSearchText: string) {
    this._searchText$.next(newSearchText);
  }
}
