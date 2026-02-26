import { ChangeDetectionStrategy, Component, inject, input, model } from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { debounceTime, filter } from "rxjs";

import { SendFilterType } from "@bitwarden/common/tools/send/types/send-filter-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { SearchModule, ToggleGroupModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SendItemsService } from "../services/send-items.service";
import { SendListFiltersService } from "../services/send-list-filters.service";

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
  imports: [FormsModule, I18nPipe, SearchModule, ToggleGroupModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendSearchComponent {
  private sendListItemService = inject(SendItemsService);
  private sendListFiltersService = inject(SendListFiltersService);

  protected readonly showSearchFilters = input<boolean>(true);
  protected readonly SendFilterType = SendFilterType;

  /** The current search text entered by the user. */
  protected readonly searchText = model("");
  /** The current search filter selected by the user */
  protected readonly searchFilter = model<SendFilterType>(SendFilterType.All);

  constructor() {
    this.subscribeToLatestSearchText();
    this.subscribeToApplyFilter();
    this.subscribeToPatchFilters();
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
   * Applies the search text filter to the Send list with a debounce delay.
   * This prevents excessive filtering while the user is still typing.
   */
  private subscribeToApplyFilter(): void {
    toObservable(this.searchText)
      .pipe(debounceTime(SearchTextDebounceInterval), takeUntilDestroyed())
      .subscribe((data) => {
        this.sendListItemService.applyFilter(data);
      });
  }

  /**
   * Applies the search filter (SendType) to the Send list
   */
  private subscribeToPatchFilters() {
    toObservable(this.searchFilter)
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        let sendType: SendType;
        switch (value) {
          case SendFilterType.Text:
            sendType = SendType.Text;
            break;
          case SendFilterType.File:
            sendType = SendType.File;
            break;
          default:
            sendType = null;
        }
        this.sendListFiltersService.filterForm.patchValue({ sendType });
      });
  }
}
