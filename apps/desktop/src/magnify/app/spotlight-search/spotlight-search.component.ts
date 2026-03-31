import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  TemplateRef,
  ViewEncapsulation,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { debounceTime, distinctUntilChanged, startWith } from "rxjs";

import { InputModule } from "@bitwarden/components";

import { MagnifySpotlightSearchType } from "../../constants";

import { UsernamePasswordResultItemComponent } from "./username-password/username-password-result-item.component";

export interface SpotlightItemAction {
  event: KeyboardEvent;
  item: unknown;
  index: number;
}

export interface SpotlightItemContext {
  /** The result item itself */
  $implicit: unknown;
  index: number;
  isSelected: boolean;
}

const DEBOUNCE_MS = 150;

@Component({
  selector: "app-spotlight-search",
  templateUrl: "spotlight-search.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: "tw-flex tw-h-full tw-flex-col",
    "[class.tw-bg-background]": "!isMac",
    "[class.tw-ring-1]": "!isMac",
    "[class.tw-ring-secondary-300]": "!isMac",
  },
  styles: [
    `
      .spotlight-results::-webkit-scrollbar {
        display: none;
      }
      .spotlight-results {
        scrollbar-width: none;
      }
    `,
  ],
  imports: [CommonModule, ReactiveFormsModule, InputModule, UsernamePasswordResultItemComponent],
})
export class SpotlightSearchComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchHeaderRef = viewChild<ElementRef<HTMLElement>>("searchHeader");

  readonly type = input<string>(MagnifySpotlightSearchType.UsernamePassword);

  readonly placeholder = input("Search…");
  readonly results = input<unknown[]>([]);

  readonly queryChange = output<string>();
  readonly itemAction = output<SpotlightItemAction>();

  readonly footerHintsTemplate = contentChild<TemplateRef<void>>("footerHints");

  protected readonly MagnifySpotlightSearchType = MagnifySpotlightSearchType;
  protected readonly isMac = magnifyIpc.platform === "darwin";
  protected readonly searchControl = new FormControl("", { nonNullable: true });
  protected readonly selectedIndex = signal(0);

  constructor() {
    effect(() => {
      this.results();
      this.selectedIndex.set(0);
    });
  }

  ngOnInit() {
    this.searchControl.valueChanges
      .pipe(
        startWith(""),
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((query) => this.queryChange.emit(query));

    setTimeout(() => {
      const input = this.searchHeaderRef()?.nativeElement?.querySelector<HTMLInputElement>("input");
      input?.focus();
    }, 50);
  }

  protected setSelectedIndex(index: number) {
    this.selectedIndex.set(index);
  }

  protected onKeydown(event: KeyboardEvent) {
    const items = this.results();
    const modKey = this.isMac ? event.metaKey : event.ctrlKey;

    switch (event.key) {
      case "Escape":
        window.close();
        break;
      case "ArrowDown":
        event.preventDefault();
        event.stopPropagation();
        this.selectedIndex.update((i) => Math.min(i + 1, items.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        event.stopPropagation();
        this.selectedIndex.update((i) => Math.max(i - 1, 0));
        break;
      default: {
        // Cmd/Ctrl+1–9: jump to item N then delegate to theme
        const digit = parseInt(event.key, 10);
        if (modKey && digit >= 1 && digit <= 9) {
          const targetIndex = digit - 1;
          const target = items[targetIndex];
          if (target !== undefined) {
            event.preventDefault();
            this.selectedIndex.set(targetIndex);
            this.itemAction.emit({ event, item: target, index: targetIndex });
          }
          break;
        }

        const selected = items[this.selectedIndex()];
        if (selected !== undefined) {
          this.itemAction.emit({ event, item: selected, index: this.selectedIndex() });
        }
      }
    }
  }
}
