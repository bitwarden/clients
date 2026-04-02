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
import { MagnifyLoginItem } from "../../../../autofill/models/magnify-items";
import { MAGNIFY_PLATFORM } from "../../../main";

export type CompletingAction = { actionId: string; itemIndex: number } | null;

// Actions that apply to a specific item type (magnifyItemType !== null).
// Navigate (null) is global UI — it is not shown per-item.
const ITEM_ACTIONS: MagnifyAction[] = MAGNIFY_ACTIONS.filter(
  (action) => action.magnifyItemType !== null,
);

@Component({
  selector: "results-list",
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: "./results-list.component.html",
  styleUrl: "./results-list.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsListComponent implements OnChanges {
  readonly results = input<MagnifyLoginItem[]>([]);
  readonly selectedIndex = input<number>(0);
  readonly hasSearched = input<boolean>(false);

  /** Set by the parent while an action is completing — triggers the green flash on the matching badge. */
  readonly completingAction = input<CompletingAction>(null);

  readonly itemSelected = output<MagnifyLoginItem>();
  readonly itemHovered = output<number>();

  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChildren("resultItem") resultItems!: QueryList<ElementRef<HTMLDivElement>>;

  /** The item-specific actions to show in each result row. */
  readonly itemActions = ITEM_ACTIONS;

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
