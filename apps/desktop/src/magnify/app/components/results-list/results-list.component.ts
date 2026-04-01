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

import { MagnifyLoginItem } from "../../../../autofill/models/magnify-items";

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

  readonly itemSelected = output<MagnifyLoginItem>();
  readonly itemHovered = output<number>();

  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChildren("resultItem") resultItems!: QueryList<ElementRef<HTMLDivElement>>;

  onImgError(event: Event): void {
    // Hide the broken image so the CSS fallback initial letter shows instead
    (event.target as HTMLImageElement).style.display = "none";
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
