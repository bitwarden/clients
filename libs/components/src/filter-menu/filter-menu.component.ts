import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  TemplateRef,
  afterNextRender,
  booleanAttribute,
  computed,
  contentChildren,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { I18nPipe } from "@bitwarden/ui-common";

import { BerryComponent } from "../berry/berry.component";
import { ButtonModule } from "../button";
import { BaseChipDirective } from "../chips/shared/base-chip.directive";
import { ChipContentComponent } from "../chips/shared/chip-content.component";
import { ChipDismissButtonComponent } from "../chips/shared/chip-dismiss-button.component";
import { IconComponent } from "../icon";
import { menuItemBaseStyles, menuItemPrimaryStyles } from "../menu/menu-item.component";
import { MenuTriggerForDirective } from "../menu/menu-trigger-for.directive";
import { MenuComponent } from "../menu/menu.component";
import { SearchComponent } from "../search/search.component";

import { FilterOptionComponent } from "./filter-option.component";
import { FilterSectionComponent } from "./filter-section.component";
import {
  FILTER_CONTROL,
  FILTER_ENTRY,
  FILTER_GROUP,
  FILTER_HOST,
  FILTER_PRESENTER,
  FilterControl,
  FilterEntry,
  FilterGroup,
  FilterPresenter,
} from "./filter-tokens";

/** Show the in-menu search once the menu has more than this many options. */
const SEARCH_THRESHOLD = 10;

/**
 * Sentinel value for the auto-injected "All" option on a single-select chip:
 * selecting it clears the chip, and it reads as selected while nothing else is.
 */
const CLEAR_FILTER = Symbol("clear-filter");

/**
 * A filter chip with a popover menu of `bit-filter-option`s (optionally grouped
 * by `bit-filter-section`). Single-select by default; set `multiple` for a
 * checkbox-style multi-select. Once the menu has more than ten options the chip
 * renders a `bit-search` at the top to narrow them.
 *
 * The chip owns its selection and exposes it as {@link FILTER_CONTROL} under its
 * `key`. When projected into a filterable surface (e.g. `bit-table-v2`) it resolves
 * that surface's {@link FILTER_HOST} by DI and self-registers, so its value folds
 * into the host's `filterValues`. It speaks only to the token contracts — never the
 * host type — so it stays usable outside a table (where the host is simply absent).
 *
 * @example
 * ```html
 * <bit-filter-menu key="type" placeholderText="Type" unsetLabel="All">
 *   <bit-filter-option [value]="'login'">Login</bit-filter-option>
 * </bit-filter-menu>
 * ```
 */
@Component({
  selector: "bit-filter-menu",
  templateUrl: "./filter-menu.component.html",
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
    NgTemplateOutlet,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: FILTER_GROUP, useExisting: forwardRef(() => FilterMenuComponent) },
    { provide: FILTER_CONTROL, useExisting: forwardRef(() => FilterMenuComponent) },
    { provide: FILTER_PRESENTER, useExisting: forwardRef(() => FilterMenuComponent) },
  ],
  hostDirectives: [
    { directive: BaseChipDirective, inputs: ["disabled", "size", "fullWidth", "maxWidthClass"] },
  ],
})
export class FilterMenuComponent implements FilterGroup, FilterControl, FilterPresenter, OnInit {
  /** The chip's key — the property its value occupies in the host's `filterValues`. */
  readonly key = input.required<string>();

  /** The chip's base label, e.g. "Type" — always shown as the prefix. */
  readonly placeholderText = input.required<string>();

  /**
   * Label shown after the prefix while inactive, e.g. "All" → "Type: All". Omit
   * to show just the prefix when nothing is selected.
   */
  readonly unsetLabel = input<string>();

  /** Multi-select (checkbox) when `true`; single-select (radio) when omitted. */
  readonly multiple = input(false, { transform: booleanAttribute });

  protected readonly baseChip = inject(BaseChipDirective, { host: true });

  /** The filterable surface this chip is projected into, if any. */
  private readonly filterHost = inject(FILTER_HOST, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  /** The selection: a single value (single-select) or an array (multi-select). */
  private readonly _value = signal<unknown>(undefined);

  /** In-menu search term; options self-hide when their label doesn't match. */
  private readonly _searchTerm = signal("");
  readonly searchTerm = this._searchTerm.asReadonly();

  /**
   * Top-level entries (loose options and sections) in document order — the chip
   * renders the menu rows from these. Options are instantiated eagerly (in a hidden
   * slot), so this is populated before the menu or dialog ever opens.
   */
  protected readonly entries = contentChildren(FILTER_ENTRY);

  /** Every option (including those nested in sections) — for the summary, search, and threshold. */
  private readonly allOptions = contentChildren(FilterOptionComponent, { descendants: true });

  /** The selected options' labels, e.g. ["Login"]. Eager (options always exist), so it's never stale. */
  private readonly labels = signal<string[]>([]);

  /** Row styling shared by every option row — `bitMenuItem`'s look plus the flex layout. */
  protected readonly optionRowClasses = [
    "tw-flex",
    "tw-items-center",
    "tw-gap-2",
    ...menuItemBaseStyles,
    ...menuItemPrimaryStyles,
  ];

  /** The chip's value, read by the host bridge. */
  readonly value = computed<unknown>(() => this._value());

  /** Whether the chip has a selection. */
  readonly active = computed(() => {
    const value = this._value();
    return this.multiple() ? Array.isArray(value) && value.length > 0 : value != null;
  });

  /** The chip's display label: `prefix`, `prefix: unsetLabel`, or (single-select) `prefix: selected`. */
  protected readonly displayLabel = computed(() => {
    const prefix = this.placeholderText();
    // Single-select reflects the selected value in the label; multi-select doesn't.
    if (!this.multiple() && this.labels().length > 0) {
      return `${prefix}: ${this.labels().join(", ")}`;
    }
    if (this.active()) {
      return prefix;
    }
    const unsetLabel = this.unsetLabel();
    return unsetLabel ? `${prefix}: ${unsetLabel}` : prefix;
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

  /** Sentinel value bound to the single-select "All" option; selecting it clears the chip. */
  protected readonly clearValue = CLEAR_FILTER;

  /** @see FilterPresenter.label — the chip's prefix, e.g. "Type". */
  readonly label = this.placeholderText;

  /** @see FilterPresenter.summary — the selected option labels, e.g. "Login". */
  readonly summary = computed(() => this.labels().join(", "));

  /**
   * The menu body (search + options) as a template, so the responsive filter dialog
   * can stamp the same options on a drill-in page. Also stamped in the popover on wide viewports.
   */
  readonly optionsTemplate = viewChild<TemplateRef<unknown>>("optionsBody");

  /** Whether the menu has enough options to warrant the in-menu search box. */
  protected readonly showSearch = computed(() => this.allOptions().length > SEARCH_THRESHOLD);

  /** A search term is entered but no option matches — show a "no results" message. */
  protected readonly noResults = computed(() => {
    if (this._searchTerm().trim() === "") {
      return false;
    }
    const options = this.allOptions();
    return options.length > 0 && options.every((o) => !this.optionVisible(o));
  });

  protected readonly disabled = computed(() => this.baseChip.disabled());

  /**
   * The count shown on each option row, keyed by the option: its explicit `count`
   * if set, else the host's faceted count (this chip's `key` pinned to the option's
   * value). Reads the host's signals, so it recomputes as the data and other filters
   * change; gated on first render like {@link labels} to avoid reading options'
   * required `value` input too early (NG0950).
   */
  protected readonly optionCounts = computed(() => {
    const counts = new Map<FilterOptionComponent, number | undefined>();
    if (!this.rendered()) {
      return counts;
    }
    const host = this.filterHost;
    const key = this.key();
    const multiple = this.multiple();
    for (const option of this.allOptions()) {
      const explicit = option.count();
      if (explicit != null) {
        counts.set(option, explicit);
        continue;
      }
      const pinned = multiple ? [option.value()] : option.value();
      counts.set(option, host?.optionCount?.(key, pinned));
    }
    return counts;
  });

  /**
   * Gates the summary effect until after the first render, so it doesn't read the
   * projected options' required `value` input before Angular has set it (NG0950).
   */
  private readonly rendered = signal(false);

  constructor() {
    afterNextRender(() => this.rendered.set(true));
    // Keep the selected-options summary in sync with the selection (post first render).
    effect(() => {
      if (!this.rendered()) {
        return;
      }
      const options = this.allOptions();
      if (options.length === 0) {
        return;
      }
      this.labels.set(options.filter((o) => this.isSelected(o.value())).map((o) => o.label()));
    });
    // Reflect the active state as the chip's pressed (selected) styling.
    effect(() => this.baseChip.selectedState.set(this.active()));
  }

  ngOnInit(): void {
    // Register with the host (if any) once inputs like `key` have resolved, not in
    // the constructor: the host seeds initial filters off `key`, which isn't set
    // yet at construction. Inert when there's no host (used outside a table).
    const host = this.filterHost;
    if (!host) {
      return;
    }
    host.registerFilter(this);
    this.destroyRef.onDestroy(() => host.unregisterFilter(this));
  }

  /** Narrows an entry to a section for the template (else `null`). */
  protected asSection(entry: FilterEntry): FilterSectionComponent | null {
    return entry.kind === "section" ? (entry as FilterSectionComponent) : null;
  }

  /** Narrows an entry to a loose option for the template (else `null`). */
  protected asOption(entry: FilterEntry): FilterOptionComponent | null {
    return entry.kind === "option" ? (entry as FilterOptionComponent) : null;
  }

  /** Whether an option matches the current search term (always true with no term). */
  protected optionVisible(option: FilterOptionComponent): boolean {
    const term = this._searchTerm().trim().toLowerCase();
    return term === "" || option.label().toLowerCase().includes(term);
  }

  /** Whether a section has any option matching the search — hides empty sections while searching. */
  protected sectionVisible(section: FilterSectionComponent): boolean {
    return section.options().some((option) => this.optionVisible(option));
  }

  /** How many of a section's options are selected — shown as the header berry. */
  protected sectionSelectedCount(section: FilterSectionComponent): number {
    return section.options().filter((option) => this.isSelected(option.value())).length;
  }

  isSelected(value: unknown): boolean {
    // The "All" option reads as selected exactly while the chip has no selection.
    if (value === CLEAR_FILTER) {
      return !this.active();
    }
    const current = this._value();
    return this.multiple() ? Array.isArray(current) && current.includes(value) : current === value;
  }

  toggle(value: unknown): void {
    // Selecting "All" clears the chip rather than setting a value.
    if (value === CLEAR_FILTER) {
      this.clear();
      return;
    }
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

  /** Clears the selection. Wired to the dismiss button, the menu's Clear footer, and the dialog. */
  clear(): void {
    this._value.set(this.multiple() ? [] : null);
    this.labels.set([]);
    this.committedCount.set(0);
  }

  /** @see FilterPresenter.flip — a chip drills into its options, so there's nothing to flip. */
  flip(): void {
    /* no-op: a chip presents options on a drill-in page rather than flipping in place. */
  }
}
