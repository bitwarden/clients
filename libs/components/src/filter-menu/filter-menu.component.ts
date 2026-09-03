import { TreeKeyManager } from "@angular/cdk/a11y";
import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  TemplateRef,
  booleanAttribute,
  computed,
  contentChildren,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { map } from "rxjs";

import { I18nPipe } from "@bitwarden/ui-common";

import { BerryComponent } from "../berry/berry.component";
import { ButtonModule } from "../button";
import { CheckboxModule } from "../checkbox";
import { BaseChipDirective } from "../chips/shared/base-chip.directive";
import { ChipContentComponent } from "../chips/shared/chip-content.component";
import { ChipDismissButtonComponent } from "../chips/shared/chip-dismiss-button.component";
import { IconComponent } from "../icon";
import {
  IconTileComponent,
  IconTileVariant,
  resolveIconTileColor,
  resolveIconTileVariant,
} from "../icon-tile";
import { menuItemBaseStyles, menuItemPrimaryStyles } from "../menu/menu-item.component";
import { MenuTriggerForDirective } from "../menu/menu-trigger-for.directive";
import { MenuComponent } from "../menu/menu.component";
import { OverflowItemDirective } from "../overflow-list";
import { radioInputClasses } from "../radio-button";
import { SearchComponent } from "../search/search.component";
import { BitwardenIcon } from "../shared/icon";
import { StatusLockupComponent } from "../status-lockup";
import { focusAfterRender } from "../utils/focus-after-render";

import { FilterOptionComponent } from "./filter-option.component";
import { FilterSectionComponent } from "./filter-section.component";
import {
  FILTER_CONTROL,
  FILTER_ENTRY,
  FILTER_GROUP,
  FILTER_HOST,
  FILTER_PRESENTER,
  FILTER_TREE_HOST,
  FilterControl,
  FilterEntry,
  FilterRow,
  FilterGroup,
  FilterPresenter,
  FilterTreeHost,
  FilterTreeNode,
} from "./filter-tokens";
import { FilterTreeRowDirective } from "./filter-tree-row.directive";

/** Show the in-menu search once the menu has more than this many options. */
const SEARCH_THRESHOLD = 10;

/** Source of unique radio-group names — see {@link FilterMenuComponent.radioName}. */
let nextRadioGroupId = 0;

/**
 * Sentinel value for the auto-injected "All" option on a single-select chip:
 * selecting it clears the chip, and it reads as selected while nothing else is.
 */
const CLEAR_FILTER = Symbol("clear-filter");

/**
 * A filter chip with a popover menu of `bit-filter-option`s. Single-select by
 * default; set `multiple` for a checkbox-style multi-select.
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
    CheckboxModule,
    FilterTreeRowDirective,
    IconTileComponent,
    StatusLockupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: FILTER_GROUP, useExisting: forwardRef(() => FilterMenuComponent) },
    { provide: FILTER_TREE_HOST, useExisting: forwardRef(() => FilterMenuComponent) },
    { provide: FILTER_CONTROL, useExisting: forwardRef(() => FilterMenuComponent) },
    { provide: FILTER_PRESENTER, useExisting: forwardRef(() => FilterMenuComponent) },
  ],
  hostDirectives: [
    { directive: BaseChipDirective, inputs: ["disabled", "size", "fullWidth", "maxWidthClass"] },
    // Lets a `bitOverflowList` ancestor measure the chip; inert with no such ancestor.
    OverflowItemDirective,
  ],
})
export class FilterMenuComponent
  implements FilterGroup, FilterControl, FilterPresenter, FilterTreeHost, OnInit
{
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

  /** Leading icon, shown on the chip and beside the filter's row in the responsive dialog. */
  readonly icon = input<BitwardenIcon>();

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
   * Top-level entries (loose options and sections) in document order. Instantiated
   * eagerly in a hidden slot, so this is populated before the menu ever opens.
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
    // Focus and disabled land on the input, not the row; mirror both onto the row.
    "tw-mb-0",
    "has-[:focus-visible]:tw-z-50",
    "has-[:focus-visible]:tw-rounded-lg",
    "has-[:focus-visible]:tw-ring-2",
    "has-[:focus-visible]:tw-ring-inset",
    "has-[:focus-visible]:tw-ring-border-focus",
    "has-[:focus-visible]:tw-bg-bg-brand-softer",
    "has-[:focus-visible]:tw-text-fg-heading",
    "has-[:disabled]:tw-cursor-default",
    "has-[:disabled]:hover:tw-bg-background",
    "has-[:disabled]:!tw-text-fg-inactive",
  ];

  /** Shared `name` so a menu's radios form one group; unique per chip so menus don't merge. */
  protected readonly radioName = `bit-filter-menu-${nextRadioGroupId++}`;

  /** The chip's value, read by the host bridge. */
  readonly value = computed<unknown>(() => this._value());

  /** @see FilterControl.clearedValue */
  readonly clearedValue = computed<unknown>(() => (this.multiple() ? [] : null));

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
  protected readonly selectedCount = computed(() => {
    const value = this._value();
    return this.multiple() && Array.isArray(value) ? value.length : 0;
  });

  /**
   * Snapshotted from {@link selectedCount} on menu close, so the chip's width doesn't
   * shift while the user toggles options.
   */
  protected readonly committedCount = signal(0);

  // `bitRadio` itself can't be used here: it drives `checked` and `name` from a form
  // control group this row doesn't have. Its classes are the same definition.
  protected readonly radioInputClasses = radioInputClasses;

  /** Sentinel value bound to the single-select "All" option; selecting it clears the chip. */
  protected readonly clearValue = CLEAR_FILTER;

  /** @see FilterPresenter.label — the chip's prefix, e.g. "Type". */
  readonly label = this.placeholderText;

  /** @see FilterPresenter.summary — the selected option labels, e.g. "Login". */
  readonly summary = computed(() => this.labels().join(", "));

  /** @see FilterPresenter.summaryLabels */
  readonly summaryLabels = this.labels.asReadonly();

  /**
   * The menu body as a template, so the popover and the dialog's drill-in stamp the
   * same options.
   */
  readonly optionsTemplate = viewChild<TemplateRef<unknown>>("optionsBody");

  /** Whether any option has children — nesting requires `multiple`. */
  protected readonly hasNesting = computed(() => this.allOptions().some((o) => o.hasChildren()));

  /** Whether the menu has enough options to warrant the in-menu search box. */
  protected readonly showSearch = computed(() => this.allOptions().length > SEARCH_THRESHOLD);

  /** A search term is entered but no option matches — show a "no results" message. */
  protected readonly noResults = computed(() => {
    if (this._searchTerm().trim() === "") {
      return false;
    }
    const options = this.allOptions();
    return options.length > 0 && options.every((o) => !this.rowVisible(o));
  });

  protected readonly disabled = computed(() => this.baseChip.disabled());

  // `read` is explicit: the button also hosts `bit-chip-content`.
  private readonly chipTriggerEl = viewChild("chipTrigger", { read: ElementRef<HTMLElement> });
  private readonly injector = inject(Injector);

  /**
   * The count shown on each option row, keyed by the option: its explicit `count` if
   * set, else the host's count for this chip's `key` pinned to the option's value.
   */
  protected readonly optionCounts = computed(() => {
    const counts = new Map<FilterOptionComponent, number | undefined>();
    const host = this.filterHost;
    const key = this.key();
    const multiple = this.multiple();
    for (const option of this.allOptions()) {
      const explicit = option.count();
      if (explicit != null) {
        counts.set(option, explicit);
        continue;
      }
      const resolved = this.optionValue(option);
      if (!resolved) {
        continue;
      }
      const pinned = multiple ? [resolved.value] : resolved.value;
      counts.set(option, host?.optionCount?.(key, pinned));
    }
    return counts;
  });

  /** The count for the "All" row: every row the host holds, since it pins no value. */
  protected readonly unsetCount = computed(() => this.filterHost?.optionCount?.(this.key(), null));

  /**
   * An option can appear in {@link allOptions} a tick before Angular binds its required
   * `value`. Reading the input still registers a signal dependency even though it throws,
   * so the caller re-runs once the value resolves.
   */
  private optionValue(option: FilterOptionComponent): { value: unknown } | undefined {
    try {
      return { value: option.value() };
    } catch {
      return undefined;
    }
  }

  constructor() {
    // The base chip defaults to `primary`, which it only draws while selected.
    this.baseChip.variant.set("subtle");
    effect(() => {
      if (!this.multiple() && this.hasNesting()) {
        throw new Error(
          "bit-filter-menu: nested `bit-filter-option`s require `multiple`. A single-select chip " +
            "holds one value, so a parent could never draw as selected.",
        );
      }
    });
    effect(() => {
      const options = this.allOptions();
      if (options.length === 0) {
        return;
      }
      const labels: string[] = [];
      for (const option of options) {
        const resolved = this.optionValue(option);
        if (resolved && this.isSelected(resolved.value)) {
          labels.push(option.label());
        }
      }
      this.labels.set(labels);
    });
    effect(() => this.baseChip.selectedState.set(this.active()));
    // Otherwise only committed on menu close, leaving a stale berry on the chip.
    effect(() => {
      if (!this.active()) {
        this.committedCount.set(0);
      }
    });
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

  protected tileVariant(option: FilterOptionComponent): IconTileVariant {
    return resolveIconTileVariant(option.iconTile(), option.disabled());
  }

  protected tileColor(option: FilterOptionComponent): string | undefined {
    return resolveIconTileColor(option.iconTile(), option.disabled());
  }

  /** Narrows an entry to a section for the template (else `null`). */
  protected asSection(entry: FilterEntry): FilterSectionComponent | null {
    return entry.kind === "section" ? (entry as FilterSectionComponent) : null;
  }

  /** Narrows an entry to a loose option for the template (else `null`). */
  protected asOption(entry: FilterEntry): FilterOptionComponent | null {
    return entry.kind === "option" ? (entry as FilterOptionComponent) : null;
  }

  /** A parent stays visible when a child matches; a section has no label of its own to match. */
  protected rowVisible(row: FilterRow): boolean {
    const term = this._searchTerm().trim().toLowerCase();
    if (row.kind === "section") {
      return row.children().some((child) => this.rowVisible(child));
    }
    return (
      term === "" ||
      row.label().toLowerCase().includes(term) ||
      row.children().some((child) => this.rowVisible(child))
    );
  }

  /** A row's own state, or forced open while searching so matches aren't buried. */
  protected rowExpanded(row: FilterRow): boolean {
    return this._searchTerm().trim() !== "" || row.open();
  }

  /** How many of a section's options are selected, nesting included — the header berry. */
  protected sectionSelectedCount(section: FilterSectionComponent): number {
    return section.allOptions().filter((option) => {
      const resolved = this.optionValue(option);
      return resolved != null && this.isSelected(resolved.value);
    }).length;
  }

  /** Whether anything in this run of options, at any depth, can expand. */
  private groupExpands(options: readonly FilterOptionComponent[]): boolean {
    return options.some((option) => option.hasChildren() || this.groupExpands(option.children()));
  }

  /** The multi-select rows, flattened in document order, each carrying its own level. */
  protected readonly treeNodes = computed<FilterTreeNode[]>(() => {
    const nodes: FilterTreeNode[] = [];
    const push = (
      rows: readonly FilterRow[],
      level: number,
      parent: number | null,
      reserveExpander: boolean,
    ) => {
      const visible = rows.filter((row) => this.rowVisible(row));
      visible.forEach((row, index) => {
        const expanded = this.rowExpanded(row);
        const self = nodes.length;
        nodes.push({
          row,
          parent,
          expanded,
          level,
          setsize: visible.length,
          posinset: index + 1,
          reserveExpander,
        });
        // Children, not `expandable()`: a non-collapsible section still shows its options.
        if (expanded && row.children().length > 0) {
          // A section is its own group: it reserves only if something inside it expands.
          const children = row.children();
          const reserve = row.kind === "section" ? this.groupExpands(children) : reserveExpander;
          push(children, level + 1, self, reserve);
        }
      });
    };

    // Top-level rows align with each other: anything expandable on that line means every
    // row on it reserves the column.
    const entries = (this.entries() as readonly FilterRow[]).filter((row) => this.rowVisible(row));
    push(
      entries,
      1,
      null,
      entries.some((row) => row.expandable()),
    );
    return nodes;
  });

  /** The rendered rows, in document order — the same order as {@link treeNodes}. */
  private readonly treeRows = viewChildren(FilterTreeRowDirective);

  // Typeahead is left off — optional for a tree, and the menu already has a search field.
  private readonly keyManager = new TreeKeyManager<FilterTreeRowDirective>(
    toObservable(this.treeRows).pipe(
      map((rows) => [...(rows as readonly FilterTreeRowDirective[])]),
    ),
    {
      // Rows are re-created as the tree expands, so key on the declaration behind each.
      trackBy: (row) => {
        const node = row.node();
        return node.row;
      },
    },
  );

  protected onTreeKeydown(event: KeyboardEvent): void {
    this.keyManager.onKeydown(event);
  }

  protected onRowFocus(row: FilterTreeRowDirective): void {
    this.keyManager.focusItem(row);
  }

  /** @see FilterTreeHost.parentRow */
  parentRow<T>(row: T): T | null {
    const rows = this.treeRows();
    const parent = rows[rows.indexOf(row as never)]?.node().parent;
    return parent == null ? null : (rows[parent] as never);
  }

  /** @see FilterTreeHost.childRows */
  childRows<T>(row: T): T[] {
    const rows = this.treeRows();
    const index = rows.indexOf(row as never);
    return index < 0 ? [] : (rows.filter((r) => r.node().parent === index) as never);
  }

  /** A section header isn't selectable; only options carry a checked state. */
  protected nodeChecked(node: FilterTreeNode): "true" | "false" | "mixed" | null {
    if (node.row.kind === "section") {
      return null;
    }
    const option = node.row as FilterOptionComponent;
    if (this.partiallySelected(option)) {
      return "mixed";
    }
    return this.optionSelected(option) ? "true" : "false";
  }

  /** Section headers aren't selectable, so they expand instead. */
  activateNode(node: FilterTreeNode): void {
    if (node.row.kind === "option") {
      this.toggleOption(node.row as FilterOptionComponent);
    } else {
      node.row.toggleExpanded();
    }
  }

  private subtreeValues(option: FilterOptionComponent): unknown[] {
    const own = this.optionValue(option);
    const values = own ? [own.value] : [];
    for (const child of option.children()) {
      values.push(...this.subtreeValues(child));
    }
    return values;
  }

  /** Whether a row draws selected: a leaf's own value, or a parent's whole subtree. */
  protected optionSelected(option: FilterOptionComponent): boolean {
    const values = this.subtreeValues(option);
    return values.length > 0 && values.every((value) => this.isSelected(value));
  }

  protected partiallySelected(option: FilterOptionComponent): boolean {
    const values = this.subtreeValues(option);
    return (
      values.some((value) => this.isSelected(value)) && !values.every((v) => this.isSelected(v))
    );
  }

  /** Selecting a row selects everything beneath it; clearing it clears the same set. */
  protected toggleOption(option: FilterOptionComponent): void {
    const values = this.subtreeValues(option);
    if (!this.multiple() || values.length <= 1) {
      this.toggle(values[0]);
      return;
    }
    const current = Array.isArray(this._value()) ? (this._value() as unknown[]) : [];
    const selectAll = !values.every((value) => current.includes(value));
    this._value.set(
      selectAll
        ? [...current, ...values.filter((value) => !current.includes(value))]
        : current.filter((value) => !values.includes(value)),
    );
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

  /**
   * The no-results state unmounts with the term, taking this button with it, so focus
   * returns to the search field. Found from the button rather than a view query: the
   * responsive dialog stamps this template too, and a view query only sees the chip's copy.
   */
  protected clearSearch(event: Event): void {
    const surface = (event.currentTarget as HTMLElement).closest("[role=dialog]");
    this.setSearchTerm("");
    focusAfterRender(this.injector, () =>
      surface?.querySelector<HTMLElement>("[data-filter-search] input"),
    );
  }

  /** Resets the search and commits the selected count to the berry when the menu closes. */
  protected onMenuClosed(): void {
    this.setSearchTerm("");
    this.committedCount.set(this.selectedCount());
  }

  /** Sets the chip's value — used to seed initial filters. */
  setValue(value: unknown): void {
    // A multi-select chip decoded from a single URL param arrives as a scalar;
    // wrap it so active() and isSelected() can treat it uniformly as an array.
    const normalized = this.multiple() && !Array.isArray(value) && value != null ? [value] : value;
    this._value.set(normalized);
    this.committedCount.set(this.selectedCount());
  }

  /**
   * Clearing from the menu's footer removes that button, so hand focus back to the
   * option list rather than letting it fall to the document body.
   */
  protected clearFromMenu(event: Event): void {
    const surface = (event.currentTarget as HTMLElement).closest<HTMLElement>("[role=dialog]");
    this.clear();
    focusAfterRender(this.injector, () => {
      const active = this.keyManager.getActiveItem() ?? this.treeRows()[0];
      if (active) {
        active.focus();
        return null;
      }
      // A search matching nothing leaves no row to return to, so fall back to the field that
      // produced the empty list, then to the surface itself.
      return surface?.querySelector<HTMLElement>("[data-filter-search] input") ?? surface;
    });
  }

  /** Likewise for the chip's dismiss button — focus returns to the chip itself. */
  protected clearFromChip(): void {
    this.clear();
    focusAfterRender(this.injector, () => this.chipTriggerEl()?.nativeElement);
  }

  /** Clears the selection. Wired to the dismiss button, the menu's Clear footer, and the dialog. */
  clear(): void {
    this._value.set(this.clearedValue());
    this.labels.set([]);
    this.committedCount.set(0);
  }

  /** @see FilterPresenter.flip — a chip drills into its options, so there's nothing to flip. */
  flip(): void {
    /* no-op: a chip presents options on a drill-in page rather than flipping in place. */
  }
}
