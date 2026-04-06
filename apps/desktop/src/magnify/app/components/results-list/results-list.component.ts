import { NgFor, NgIf } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnChanges,
  QueryList,
  ViewChildren,
  input,
  output,
} from "@angular/core";

import { MAGNIFY_ACTIONS, MagnifyAction } from "../../../../autofill/models/magnify-actions";
import {
  isMagnifyCardItem,
  isMagnifyLoginItem,
  MagnifySearchResultItem,
} from "../../../../autofill/models/magnify-commands";
import { MAGNIFY_PLATFORM } from "../../utils/magnify-platform";

export type CompletingAction = { actionId: string; itemIndex: number } | null;

@Component({
  selector: "results-list",
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: "./results-list.component.html",
  styleUrl: "./results-list.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsListComponent implements OnChanges {
  readonly results = input<MagnifySearchResultItem[]>([]);
  readonly selectedIndex = input<number>(0);
  readonly hasSearched = input<boolean>(false);

  /** Set by the parent while an action is completing — triggers the green flash on the matching badge. */
  readonly completingAction = input<CompletingAction>(null);

  readonly itemSelected = output<MagnifySearchResultItem>();
  readonly itemHovered = output<number>();

  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChildren("resultItem") resultItems!: QueryList<ElementRef<HTMLDivElement>>;

  /** Returns the item-specific actions for a given result row. */
  getItemActions(item: MagnifySearchResultItem): MagnifyAction[] {
    return MAGNIFY_ACTIONS.filter(
      (action) => action.magnifyItemType !== null && action.magnifyItemType === item.itemType,
    );
  }

  getIconUrl(item: MagnifySearchResultItem): string | null {
    return isMagnifyLoginItem(item) ? item.iconUrl : null;
  }

  getSubtitle(item: MagnifySearchResultItem): string {
    if (isMagnifyLoginItem(item)) {
      return item.username;
    }
    if (isMagnifyCardItem(item)) {
      return item.brand ?? "";
    }
    return "";
  }

  onImgError(event: Event): void {
    // Hide the broken image so the CSS fallback initial letter shows instead
    (event.target as HTMLImageElement).style.display = "none";
  }

  /** Returns the platform-appropriate shortcut label for a given action. */
  getActionLabel(action: MagnifyAction): string {
    switch (MAGNIFY_PLATFORM) {
      case "darwin":
        return action.labelMacOs;
      case "win32":
        return action.labelWindows;
      case "linux":
        return action.labelLinux;
      default:
        return action.labelWindows;
    }
  }

  ngOnChanges(): void {
    // Scroll the selected item into view after Angular updates the DOM.
    // Use a microtask so ViewChildren are refreshed first.
    void Promise.resolve().then(() => this.scrollSelectedIntoView());
  }

  private scrollSelectedIntoView(): void {
    const items = this.resultItems?.toArray();
    if (items && items[this.selectedIndex()]) {
      items[this.selectedIndex()].nativeElement.scrollIntoView({ block: "nearest" });
    }
  }
}
