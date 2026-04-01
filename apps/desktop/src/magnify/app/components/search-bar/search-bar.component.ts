import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  signal,
} from "@angular/core";

import { MagnifyLoginItem } from "../../../../autofill/models/magnify-commands";
import { CommandService } from "../../../services/command-service";
import { ResultsListComponent } from "../results-list/results-list.component";

@Component({
  selector: "search-bar",
  standalone: true,
  imports: [ResultsListComponent],
  templateUrl: "./search-bar.component.html",
  styleUrl: "./search-bar.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBarComponent implements AfterViewInit {
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("searchInput") searchInput!: ElementRef<HTMLInputElement>;

  readonly results = signal<MagnifyLoginItem[]>([]);
  readonly selectedIndex = signal<number>(0);
  readonly hasSearched = signal<boolean>(false);

  constructor(private readonly commandService: CommandService) {}

  ngAfterViewInit() {
    this.searchInput.nativeElement.focus();
  }

  async onInput(): Promise<void> {
    const query = this.searchInput.nativeElement.value;

    if (!query.trim()) {
      this.results.set([]);
      this.selectedIndex.set(0);
      this.hasSearched.set(false);
      return;
    }

    this.hasSearched.set(true);
    const results = await this.commandService.searchVault(query);
    this.results.set(results);
    this.selectedIndex.set(0);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (this.results().length === 0) {
        return;
      }
      this.selectedIndex.set(Math.min(this.selectedIndex() + 1, this.results().length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (this.results().length === 0) {
        return;
      }
      this.selectedIndex.set(Math.max(this.selectedIndex() - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = this.results()[this.selectedIndex()];
      if (item) {
        void this.commandService.copyPassword(item.id);
      }
    }
  }

  onItemSelected(item: MagnifyLoginItem): void {
    void this.commandService.copyPassword(item.id);
  }

  onItemHovered(index: number): void {
    this.selectedIndex.set(index);
  }
}
