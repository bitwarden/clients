import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { Subject, Subscription, debounceTime, filter } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SearchModule } from "@bitwarden/components";

import { SendItemsService } from "../services/send-items.service";

const SearchTextDebounceInterval = 200;

@Component({
  imports: [CommonModule, SearchModule, JslibModule, FormsModule],
  selector: "tools-send-search",
  templateUrl: "send-search.component.html",
})
export class SendSearchComponent {
  searchText: string = "";

  private searchText$ = new Subject<string>();

  constructor(private sendListItemService: SendItemsService) {
    this.subscribeToLatestSearchText();
    this.subscribeToApplyFilter();
  }

  onSearchTextChanged() {
    this.searchText$.next(this.searchText);
  }

  subscribeToLatestSearchText(): Subscription {
    return this.sendListItemService.latestSearchText$
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
      .pipe(debounceTime(SearchTextDebounceInterval), takeUntilDestroyed())
      .subscribe((data) => {
        this.sendListItemService.applyFilter(data);
      });
  }
}
