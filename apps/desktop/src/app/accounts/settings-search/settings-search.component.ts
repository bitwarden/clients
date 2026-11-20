import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BitFieldContainerDirective, IconButtonModule, IconModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { normalizeSettingsSearchText, searchSettings } from "./search-settings";
import {
  SETTINGS_SEARCH_ENTRIES,
  SETTINGS_SEARCH_PAGES,
  SettingsSearchEntry,
  SettingsSearchEntryId,
  SettingsSearchVisibility,
} from "./settings-search.registry";

let nextId = 0;

/** A search result the user picked, and whether they picked it with the keyboard. */
export interface SettingsSearchSelection {
  entry: SettingsSearchEntry;
  /** `true` when chosen with Enter, so the host can keep the revealed control's focus ring. */
  viaKeyboard: boolean;
}

/**
 * Search field for the desktop Settings view, following the ARIA combobox-with-listbox pattern.
 * Emits `selected` with the chosen entry; the host switches page and reveals the row.
 * The field mirrors `bit-search`, which cannot be used here because it does not expose the combobox
 * attributes on its input.
 */
@Component({
  selector: "app-settings-search",
  templateUrl: "settings-search.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BitFieldContainerDirective, IconButtonModule, IconModule, I18nPipe],
  host: {
    class: "tw-relative tw-block",
    "(focusout)": "onFocusOut($event)",
  },
})
export class SettingsSearchComponent {
  private readonly i18nService = inject(I18nService);
  private readonly injector = inject(Injector);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Searchable settings. Defaults to the full registry. */
  readonly entries = input<readonly SettingsSearchEntry[]>(SETTINGS_SEARCH_ENTRIES);
  /**
   * Whether a setting row is currently rendered. Signals read inside the predicate are tracked,
   * so results update when they change.
   */
  readonly isVisible = input<SettingsSearchVisibility>(() => true);
  readonly selected = output<SettingsSearchSelection>();

  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>("searchInput");

  private readonly instanceId = nextId++;
  protected readonly listboxId = `settings-search-listbox-${this.instanceId}`;
  protected readonly pages = SETTINGS_SEARCH_PAGES;

  protected readonly query = signal("");
  protected readonly activeIndex = signal(-1);
  private readonly open = signal(false);

  private readonly hasQuery = computed(() => normalizeSettingsSearchText(this.query()).length > 0);

  protected readonly results = computed(() => {
    const isVisible = this.isVisible();
    return searchSettings(
      this.entries(),
      this.query(),
      (key) => this.i18nService.t(key),
      (id) => isVisible(id),
    );
  });

  protected readonly panelOpen = computed(() => this.open() && this.hasQuery());
  protected readonly expanded = computed(() => this.panelOpen() && this.results().length > 0);
  protected readonly empty = computed(() => this.hasQuery() && this.results().length === 0);

  protected readonly activeOptionId = computed(() => {
    const active = this.results()[this.activeIndex()];
    return this.expanded() && active ? this.optionId(active.entry.id) : null;
  });

  protected readonly statusText = computed(() => {
    if (!this.hasQuery()) {
      return "";
    }
    const count = this.results().length;
    if (count === 0) {
      return this.i18nService.t("settingsSearchNoResultsVfo1");
    }
    if (count === 1) {
      return this.i18nService.t("settingsSearchOneResultVfo1");
    }
    return this.i18nService.t("settingsSearchResultCountVfo1", count);
  });

  protected optionId(entryId: SettingsSearchEntryId): string {
    return `settings-search-option-${this.instanceId}-${entryId}`;
  }

  protected onInput(event: Event) {
    if (event.target instanceof HTMLInputElement) {
      this.query.set(event.target.value);
    }
    this.activeIndex.set(-1);
    this.open.set(true);
  }

  protected onFocus() {
    this.open.set(true);
  }

  protected onFocusOut(event: FocusEvent) {
    const next = event.relatedTarget;
    if (next instanceof Node && this.elementRef.nativeElement.contains(next)) {
      return;
    }
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  protected onKeydown(event: KeyboardEvent) {
    const count = this.results().length;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.open.set(true);
        if (count > 0) {
          this.moveActive((this.activeIndex() + 1) % count);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        this.open.set(true);
        if (count > 0) {
          this.moveActive(this.activeIndex() <= 0 ? count - 1 : this.activeIndex() - 1);
        }
        break;
      case "Enter": {
        // Always prevent default so Enter never submits an enclosing form.
        event.preventDefault();
        if (this.expanded()) {
          const result = this.results()[Math.max(this.activeIndex(), 0)];
          this.select(result.entry, true);
        }
        break;
      }
      case "Escape":
        if (this.query()) {
          event.preventDefault();
          event.stopPropagation();
          this.clear();
        }
        break;
    }
  }

  protected select(entry: SettingsSearchEntry, viaKeyboard = false) {
    this.selected.emit({ entry, viaKeyboard });
    this.query.set("");
    this.activeIndex.set(-1);
    this.open.set(false);
  }

  protected clear() {
    this.query.set("");
    this.activeIndex.set(-1);
    this.searchInput().nativeElement.focus();
  }

  private moveActive(index: number) {
    this.activeIndex.set(index);
    const id = this.activeOptionId();
    afterNextRender(
      () => {
        if (id) {
          document.getElementById(id)?.scrollIntoView?.({ block: "nearest" });
        }
      },
      { injector: this.injector },
    );
  }
}
