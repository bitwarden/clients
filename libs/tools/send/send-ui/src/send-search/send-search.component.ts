import { ChangeDetectionStrategy, Component, inject, model } from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { debounceTime, filter } from "rxjs";

import { SearchModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SendItemsService } from "../services/send-items.service";

const SearchTextDebounceInterval = 200;

/**
 * Search component for filtering Send items.
 *
 * Provides a search input that filters the Send list with debounced updates.
 * Syncs with the service's latest search text to maintain state across navigation.
 */
@Component({
  selector: "tools-send-search",
  templateUrl: "send-search.component.html",
  imports: [FormsModule, I18nPipe, SearchModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendSearchComponent {
  private sendListItemService = inject(SendItemsService);

  /** The current search text entered by the user. */
  protected readonly searchText = model("");

  constructor() {
    this.subscribeToLatestSearchText();
    this.subscribeToApplyFilter();
  }

  private subscribeToLatestSearchText(): void {
    this.sendListItemService.latestSearchText$
      .pipe(
        takeUntilDestroyed(),
        filter((data) => !!data),
      )
      .subscribe((text) => {
        this.searchText.set(text);
      });
  }

  /**
   * Applies the search filter to the Send list with a debounce delay.
   * This prevents excessive filtering while the user is still typing.
   */
  private subscribeToApplyFilter(): void {
    toObservable(this.searchText)
      .pipe(debounceTime(SearchTextDebounceInterval), takeUntilDestroyed())
      .subscribe((data) => {
        this.sendListItemService.applyFilter(data);
      });
  }
}
