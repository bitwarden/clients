import { CommonModule } from "@angular/common";
import { Component, NgZone } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import {
  Subject,
  Subscription,
  combineLatest,
  debounce,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  timer,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SearchTextDebounceInterval } from "@bitwarden/common/vault/services/search.service";
import { SearchModule } from "@bitwarden/components";

import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";
import { VaultPopupLoadingService } from "../../../services/vault-popup-loading.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  imports: [CommonModule, SearchModule, JslibModule, FormsModule],
  selector: "app-vault-v2-search",
  templateUrl: "vault-v2-search.component.html",
})
export class VaultV2SearchComponent {
  searchText: string = "";

  private searchText$ = new Subject<string>();

  protected loading$ = this.vaultPopupLoadingService.loading$;
  constructor(
    private vaultPopupItemsService: VaultPopupItemsService,
    private vaultPopupLoadingService: VaultPopupLoadingService,
    private configService: ConfigService,
    private ngZone: NgZone,
  ) {
    this.subscribeToLatestSearchText();
    this.subscribeToApplyFilter();
  }

  onSearchTextChanged() {
    this.searchText$.next(this.searchText);
  }

  subscribeToLatestSearchText(): Subscription {
    return this.vaultPopupItemsService.searchText$
      .pipe(
        takeUntilDestroyed(),
        filter((data) => !!data),
      )
      .subscribe((text) => {
        this.searchText = text;
      });
  }

  subscribeToApplyFilter(): void {
    this.configService
      .getFeatureFlag$(FeatureFlag.VaultLoadingSkeletons)
      .pipe(
        switchMap((enabled) => {
          if (!enabled) {
            return this.searchText$.pipe(
              debounceTime(SearchTextDebounceInterval),
              distinctUntilChanged(),
              takeUntilDestroyed(),
            );
          }

          return combineLatest([this.searchText$, this.loading$]).pipe(
            debounce(([_, isLoading]) => {
              // If loading apply immediately to avoid stale searches.
              // After loading completes, debounce to avoid excessive searches.
              const delayTime = isLoading ? 0 : SearchTextDebounceInterval;
              return timer(delayTime);
            }),
            distinctUntilChanged(
              ([prevText, prevLoading], [newText, newLoading]) =>
                prevText === newText && prevLoading === newLoading,
            ),
            takeUntilDestroyed(),
            map(([text, _]) => text),
          );
        }),
      )
      .subscribe((text) => {
        this.ngZone.runOutsideAngular(() => {
          this.ngZone.run(() => {
            this.vaultPopupItemsService.applyFilter(text);
          });
        });
      });
  }
}
