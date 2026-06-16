import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  contentChildren,
  effect,
  forwardRef,
  inject,
  input,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { I18nPipe } from "@bitwarden/ui-common";

import { BerryComponent } from "../berry/berry.component";
import { ButtonModule } from "../button";
import { BaseChipDirective } from "../chips/shared/base-chip.directive";
import { ChipContentComponent } from "../chips/shared/chip-content.component";
import { ChipDismissButtonComponent } from "../chips/shared/chip-dismiss-button.component";
import { MenuTriggerForDirective } from "../menu/menu-trigger-for.directive";
import { MenuComponent } from "../menu/menu.component";
import { SearchComponent } from "../search/search.component";

import { FilterOptionComponent } from "./filter-option.component";
import { FILTER_CONTROL, FILTER_GROUP, FilterControl, FilterGroup } from "./filter-tokens";

/** Show the in-menu search once the menu has more than this many options. */
const SEARCH_THRESHOLD = 10;

/**
 * A filter chip with a popover menu of `bit-filter-option`s (optionally grouped
 * by `bit-filter-section`). Single-select by default; set `multiple` for a
 * checkbox-style multi-select. Once the menu has more than ten options the chip
 * renders a `bit-search` at the top to narrow them.
 *
 * The chip owns its selection and exposes it as {@link FILTER_CONTROL} under its
 * `key`, so a host bridge (`bitTableFilter` for `bit-table-v2`) folds it into the
 * host's `filterValues`. The chip never depends on the host type.
 *
 * @example
 * ```html
 * <bit-filter-chip key="type" placeholderText="Type" nullLabel="All" bitTableFilter>
 *   <bit-filter-option [value]="'login'">Login</bit-filter-option>
 * </bit-filter-chip>
 * ```
 */
@Component({
  selector: "bit-filter-chip",
  templateUrl: "./filter-chip.component.html",
  imports: [
    BerryComponent,
    ChipContentComponent,
    ChipDismissButtonComponent,
    MenuComponent,
    MenuTriggerForDirective,
    SearchComponent,
    ButtonModule,
    FormsModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: FILTER_GROUP, useExisting: forwardRef(() => FilterChipComponent) },
    { provide: FILTER_CONTROL, useExisting: forwardRef(() => FilterChipComponent) },
  ],
  hostDirectives: [
    { directive: BaseChipDirective, inputs: ["disabled", "size", "fullWidth", "maxWidthClass"] },
  ],
})
export class FilterChipComponent implements FilterGroup, FilterControl {
  /** The chip's key — the property its value occupies in the host's `filterValues`. */
  readonly key = input.required<string>();

  /** The chip's base label, e.g. "Type" — always shown as the prefix. */
  readonly placeholderText = input.required<string>();

  /**
   * Label shown after the prefix while inactive, e.g. "All" → "Type: All". Omit
   * to show just the prefix when nothing is selected.
   */
  readonly nullLabel = input<string>();

  /** Multi-select (checkbox) when `true`; single-select (radio) when omitted. */
  readonly multiple = input(false, { transform: booleanAttribute });

  protected readonly baseChip = inject(BaseChipDirective, { host: true });

  /** The selection: a single value (single-select) or an array (multi-select). */
  private readonly _value = signal<unknown>(undefined);

  /** In-menu search term; options self-hide when their label doesn't match. */
  private readonly _searchTerm = signal("");
  readonly searchTerm = this._searchTerm.asReadonly();

  /** Projected options in the open menu. Empty while the menu is closed. */
  private readonly options = contentChildren(FilterOptionComponent, { descendants: true });

  /**
   * Selected option labels, cached from the open menu. `bit-menu` destroys its
   * content on close, so this is retained for the closed chip's label.
   */
  private readonly labels = signal<string[]>([]);

  /** The chip's value, read by the host bridge. */
  readonly value = computed<unknown>(() => this._value());

  /** Whether the chip has a selection. */
  readonly active = computed(() => {
    const value = this._value();
    return this.multiple() ? Array.isArray(value) && value.length > 0 : value != null;
  });

  /** The chip's display label: `prefix`, `prefix: nullLabel`, or (single-select) `prefix: selected`. */
  protected readonly displayLabel = computed(() => {
    const prefix = this.placeholderText();
    // Single-select reflects the selected value in the label; multi-select doesn't.
    if (!this.multiple() && this.labels().length > 0) {
      return `${prefix}: ${this.labels().join(", ")}`;
    }
    if (this.active()) {
      return prefix;
    }
    const nullLabel = this.nullLabel();
    return nullLabel ? `${prefix}: ${nullLabel}` : prefix;
  });

  /** Live count of selected options (`multiple` only). Source for the committed berry value. */
  private readonly selectedCount = computed(() => {
    const value = this._value();
    return this.multiple() && Array.isArray(value) ? value.length : 0;
  });

  /**
   * The count shown in the chip's trailing berry. Snapshotted from {@link selectedCount}
   * on menu close (and on clear/seed) — not live — so the chip's width doesn't shift
   * while the user toggles options in the open menu.
   */
  protected readonly committedCount = signal(0);

  /** Whether the menu has enough options to warrant the in-menu search box. */
  protected readonly showSearch = computed(() => this.options().length > SEARCH_THRESHOLD);

  /** A search term is entered but every option is hidden — show a "no results" message. */
  protected readonly noResults = computed(() => {
    if (this._searchTerm().trim() === "") {
      return false;
    }
    const options = this.options();
    return options.length > 0 && options.every((o) => o.hidden());
  });

  protected readonly disabled = computed(() => this.baseChip.disabled());

  constructor() {
    // Cache the selected labels while the menu is open; retain them once it closes.
    effect(() => {
      const options = this.options();
      if (options.length === 0) {
        return;
      }
      this.labels.set(options.filter((o) => this.isSelected(o.value())).map((o) => o.label()));
    });
    // Reflect the active state as the chip's pressed (selected) styling.
    effect(() => this.baseChip.selectedState.set(this.active()));
  }

  isSelected(value: unknown): boolean {
    const current = this._value();
    return this.multiple() ? Array.isArray(current) && current.includes(value) : current === value;
  }

  toggle(value: unknown): void {
    if (this.multiple()) {
      const current = Array.isArray(this._value()) ? (this._value() as unknown[]) : [];
      this._value.set(
        current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      );
    } else {
      this._value.set(value);
    }
  }

  setSearchTerm(term: string): void {
    this._searchTerm.set(term);
  }

  /** Resets the search and commits the selected count to the berry when the menu closes. */
  protected onMenuClosed(): void {
    this.setSearchTerm("");
    this.committedCount.set(this.selectedCount());
  }

  /** Sets the chip's value — used to seed initial filters. */
  setValue(value: unknown): void {
    this._value.set(value);
    this.committedCount.set(this.selectedCount());
  }

  /** Clears the selection. Wired to the dismiss button and the menu's Clear footer. */
  protected clear(): void {
    this._value.set(this.multiple() ? [] : null);
    this.labels.set([]);
    this.committedCount.set(0);
  }
}
