import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { Subscription, debounceTime, filter } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SearchModule } from "@bitwarden/components";

import { cacheSignal } from "../../../../../platform/popup/view-cache/popup-view-cache.service";
import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";

const SearchTextDebounceInterval = 200;

@Component({
  imports: [CommonModule, SearchModule, JslibModule, FormsModule],
  standalone: true,
  selector: "app-vault-v2-search",
  templateUrl: "vault-v2-search.component.html",
})
export class VaultV2SearchComponent {
  protected searchText = cacheSignal({
    key: "popup-vault-search-cache",
    initialValue: "",
  });

  private searchText$ = toObservable(this.searchText);

  constructor(private vaultPopupItemsService: VaultPopupItemsService) {
    this.subscribeToLatestSearchText();
    this.subscribeToApplyFilter();
  }

  subscribeToLatestSearchText(): Subscription {
    return this.vaultPopupItemsService.latestSearchText$
      .pipe(
        takeUntilDestroyed(),
        filter((data) => !!data),
      )
      .subscribe((text) => {
        this.searchText.set(text);
      });
  }

  subscribeToApplyFilter(): Subscription {
    return this.searchText$
      .pipe(debounceTime(SearchTextDebounceInterval), takeUntilDestroyed())
      .subscribe((data) => {
        this.vaultPopupItemsService.applyFilter(data);
      });
  }
}
