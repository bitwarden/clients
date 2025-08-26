import { CommonModule } from "@angular/common";
import { Component, NgZone } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { Subject, Subscription, debounceTime, distinctUntilChanged, filter } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SearchTextDebounceInterval } from "@bitwarden/common/vault/services/search.service";
import { SearchModule } from "@bitwarden/components";

import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";

@Component({
  imports: [CommonModule, SearchModule, JslibModule, FormsModule],
  selector: "app-vault-v2-search",
  templateUrl: "vault-v2-search.component.html",
})
export class VaultV2SearchComponent {
  searchText: string = "";

  private searchText$ = new Subject<string>();

  constructor(
    private vaultPopupItemsService: VaultPopupItemsService,
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

  subscribeToApplyFilter(): Subscription {
    return this.searchText$
      .pipe(debounceTime(SearchTextDebounceInterval), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((data) => {
        this.ngZone.runOutsideAngular(() => {
          this.ngZone.run(() => {
            this.vaultPopupItemsService.applyFilter(data);
          });
        });
      });
  }
}
