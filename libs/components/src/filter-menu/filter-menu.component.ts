import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
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
import { OverflowItemDirective } from "../overflow-list";
import { SearchComponent } from "../search/search.component";
import { BitwardenIcon } from "../shared/icon";

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

/** One row of a multi-select menu's flattened tree — a section header or an option. */
type FilterTreeNode =
  | {
      kind: "section";
      section: FilterSectionComponent;
      level: number;
      setsize: number;
      posinset: number;
    }
  | {
      kind: "option";
      option: FilterOptionComponent;
      level: number;
      setsize: number;
      posinset: number;
    };

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
    // Lets a `bitOverflowList` ancestor measure the chip; inert with no such ancestor.
    OverflowItemDirective,
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
    // The row is a `label` wrapping a visually hidden input, so focus and disabled
    // land on the input rather than the row. Mirror both onto the row, and drop the
    // margin a bare `label` would otherwise carry.
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

  /**
   * Shared `name` for a single-select menu's radios. Radios only behave as one group
   * — arrow keys moving between them, one tab stop for the set — when they share a
   * name, and it must be unique per chip so two menus don't merge into one group.
   */
  protected readonly radioName = `bit-filter-menu-${nextRadioGroupId++}`;

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
  protected readonly selectedCount = computed(() => {
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

  /** @see FilterPresenter.summaryLabels */
  readonly summaryLabels = this.labels.asReadonly();

  /**
   * The menu body (search + options) as a template, so the responsive filter dialog
   * can stamp the same options on a drill-in page. Also stamped in the popover on wide viewports.
   */
  readonly optionsTemplate = viewChild<TemplateRef<unknown>>("optionsBody");

  /**
   * Whether any option in this menu has children. Leaves reserve the expander's width
   * when so, to keep every checkbox in a column.
   */
  protected readonly hasNesting = computed(() => this.allOptions().some((o) => o.hasChildren()));

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

  /** The `role="tree"` container, so key handling can move focus between its rows. */
  private readonly treeEl = viewChild<ElementRef<HTMLElement>>("tree");
  private readonly injector = inject(Injector);

  /**
   * The count shown on each option row, keyed by the option: its explicit `count`
   * if set, else the host's faceted count (this chip's `key` pinned to the option's
   * value). Reads the host's signals, so it recomputes as the data and other filters
   * change.
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

  /**
   * The count shown on the single-select "All" row: every row the host holds, since
   * "All" pins no value. `undefined` without a host or a `[filter]`.
   */
  protected readonly unsetCount = computed(() => this.filterHost?.optionCount?.(this.key(), null));

  /**
   * Safely reads an option's `value` input. An option can appear in {@link allOptions}
   * one tick before Angular finishes binding its required `value` input — e.g. when an
   * async list (like a collections stream) appends a `bit-filter-option` after this chip
   * has already rendered. Reading the input here still registers it as a signal
   * dependency even though it throws, so the consuming effect/computed re-runs on its
   * own once the value resolves.
   */
  private optionValue(option: FilterOptionComponent): { value: unknown } | undefined {
    try {
      return { value: option.value() };
    } catch {
      return undefined;
    }
  }

  constructor() {
    // Unselected filter chips are white with a grey border, not brand-tinted; the
    // base chip only routes to `primary` while selected, so `subtle` is the resting
    // variant. Set rather than defaulted so a consumer's `variant` still wins.
    this.baseChip.variant.set("subtle");
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
    // Reflect the active state as the chip's pressed (selected) styling.
    effect(() => this.baseChip.selectedState.set(this.active()));
    // The berry count is otherwise only committed on menu close. Toggling the last
    // selection off in an open menu drops the dismiss button, so a stale berry would
    // be left sitting at the end of the chip until it closed.
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

  /** Narrows an entry to a section for the template (else `null`). */
  protected asSection(entry: FilterEntry): FilterSectionComponent | null {
    return entry.kind === "section" ? (entry as FilterSectionComponent) : null;
  }

  /** Narrows an entry to a loose option for the template (else `null`). */
  protected asOption(entry: FilterEntry): FilterOptionComponent | null {
    return entry.kind === "option" ? (entry as FilterOptionComponent) : null;
  }

  /**
   * Whether an option shows for the current search term. A parent stays visible when
   * anything beneath it matches, so a nested match is reachable through its ancestors
   * rather than being hidden with them.
   */
  protected optionVisible(option: FilterOptionComponent): boolean {
    const term = this._searchTerm().trim().toLowerCase();
    if (term === "") {
      return true;
    }
    return (
      option.label().toLowerCase().includes(term) ||
      option.children().some((child) => this.optionVisible(child))
    );
  }

  /**
   * Whether a parent's children are shown: its own expansion state, or forced open
   * while a search is narrowing the list so matches aren't buried in a collapsed row.
   */
  protected optionExpanded(option: FilterOptionComponent): boolean {
    return this._searchTerm().trim() !== "" || option.open();
  }

  /** @see optionExpanded — same forcing-open while searching, for a section header. */
  protected sectionExpanded(section: FilterSectionComponent): boolean {
    return this._searchTerm().trim() !== "" || section.open();
  }

  /** Whether a section has any option matching the search — hides empty sections while searching. */
  protected sectionVisible(section: FilterSectionComponent): boolean {
    return section.options().some((option) => this.optionVisible(option));
  }

  /** How many of a section's options are selected, nesting included — the header berry. */
  protected sectionSelectedCount(section: FilterSectionComponent): number {
    return section.allOptions().filter((option) => {
      const resolved = this.optionValue(option);
      return resolved != null && this.isSelected(resolved.value);
    }).length;
  }

  /**
   * The multi-select menu's rows, flattened in the order they appear. A tree may be
   * presented flat as long as each row carries its own level and sibling position,
   * which keeps the template one loop instead of a recursive one and gives the
   * keyboard model a plain array to move through.
   */
  protected readonly treeNodes = computed<FilterTreeNode[]>(() => {
    const nodes: FilterTreeNode[] = [];
    const pushOptions = (options: readonly FilterOptionComponent[], level: number) => {
      const visible = options.filter((option) => this.optionVisible(option));
      visible.forEach((option, index) => {
        nodes.push({
          kind: "option",
          option,
          level,
          setsize: visible.length,
          posinset: index + 1,
        });
        if (option.hasChildren() && this.optionExpanded(option)) {
          pushOptions(option.children(), level + 1);
        }
      });
    };

    const entries = this.entries().filter((entry) => {
      const section = this.asSection(entry);
      return section ? this.sectionVisible(section) : this.optionVisible(entry as never);
    });
    entries.forEach((entry, index) => {
      const section = this.asSection(entry);
      if (section) {
        nodes.push({
          kind: "section",
          section,
          level: 1,
          setsize: entries.length,
          posinset: index + 1,
        });
        if (this.sectionExpanded(section)) {
          pushOptions(section.options(), 2);
        }
        return;
      }
      const option = this.asOption(entry);
      if (!option) {
        return;
      }
      nodes.push({
        kind: "option",
        option,
        level: 1,
        setsize: entries.length,
        posinset: index + 1,
      });
      if (option.hasChildren() && this.optionExpanded(option)) {
        pushOptions(option.children(), 2);
      }
    });
    return nodes;
  });

  /** The row the tree's single tab stop currently sits on. */
  private readonly activeNodeIndex = signal(0);

  /** Clamped to the rows that actually exist, so collapsing or searching can't strand it. */
  protected readonly activeIndex = computed(() =>
    Math.min(this.activeNodeIndex(), Math.max(this.treeNodes().length - 1, 0)),
  );

  /** Whether a row expands, and whether it currently is. */
  protected nodeExpandable(node: FilterTreeNode): boolean {
    return node.kind === "section" ? node.section.collapsible() : node.option.hasChildren();
  }

  protected nodeExpanded(node: FilterTreeNode): boolean {
    return node.kind === "section"
      ? this.sectionExpanded(node.section)
      : this.optionExpanded(node.option);
  }

  /** A section header isn't selectable; only options carry a checked state. */
  protected nodeChecked(node: FilterTreeNode): "true" | "false" | "mixed" | null {
    if (node.kind === "section") {
      return null;
    }
    if (this.partiallySelected(node.option)) {
      return "mixed";
    }
    return this.optionSelected(node.option) ? "true" : "false";
  }

  protected nodeLabel(node: FilterTreeNode): string {
    return node.kind === "section" ? node.section.label() : node.option.label();
  }

  protected nodeDisabled(node: FilterTreeNode): boolean {
    return node.kind === "option" && node.option.disabled();
  }

  protected setActiveIndex(index: number): void {
    this.activeNodeIndex.set(index);
  }

  /** Expand or collapse a row, whichever it currently isn't. */
  protected toggleNodeExpanded(node: FilterTreeNode): void {
    if (node.kind === "section") {
      node.section.toggle();
    } else {
      node.option.toggleOpen();
    }
  }

  /** Select or clear a row. Section headers only expand, so they no-op here. */
  protected activateNode(node: FilterTreeNode): void {
    if (node.kind === "option") {
      this.toggleOption(node.option);
    } else {
      this.toggleNodeExpanded(node);
    }
  }

  /**
   * Tree navigation. Up/Down walk the rows that are actually on screen; Right opens a
   * closed row and then steps into it; Left closes an open one and otherwise climbs to
   * the parent; Space and Enter select.
   */
  protected onTreeKeydown(event: KeyboardEvent): void {
    const nodes = this.treeNodes();
    if (nodes.length === 0) {
      return;
    }
    const index = this.activeIndex();
    const node = nodes[index];
    let next: number | undefined;

    switch (event.key) {
      case "ArrowDown":
        next = Math.min(index + 1, nodes.length - 1);
        break;
      case "ArrowUp":
        next = Math.max(index - 1, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = nodes.length - 1;
        break;
      case "ArrowRight":
        if (this.nodeExpandable(node) && !this.nodeExpanded(node)) {
          this.toggleNodeExpanded(node);
        } else if (this.nodeExpandable(node)) {
          next = Math.min(index + 1, nodes.length - 1);
        }
        break;
      case "ArrowLeft":
        if (this.nodeExpandable(node) && this.nodeExpanded(node)) {
          this.toggleNodeExpanded(node);
        } else {
          // Climb to the nearest row a level above this one.
          for (let i = index - 1; i >= 0; i--) {
            if (nodes[i].level < node.level) {
              next = i;
              break;
            }
          }
        }
        break;
      case " ":
      case "Enter":
        this.activateNode(node);
        break;
      default:
        return;
    }

    event.preventDefault();
    if (next != null) {
      this.setActiveIndex(next);
      this.focusActiveRow();
    }
  }

  /** Moves DOM focus onto the active row once the roving tabindex has been rebound. */
  private focusActiveRow(): void {
    afterNextRender(
      () => {
        const rows =
          this.treeEl()?.nativeElement.querySelectorAll<HTMLElement>('[role="treeitem"]');
        rows?.[this.activeIndex()]?.focus();
      },
      { injector: this.injector },
    );
  }

  /** An option's own value followed by every value nested beneath it. */
  private subtreeValues(option: FilterOptionComponent): unknown[] {
    const own = this.optionValue(option);
    const values = own ? [own.value] : [];
    for (const child of option.children()) {
      values.push(...this.subtreeValues(child));
    }
    return values;
  }

  /**
   * Whether an option's row draws as selected: for a leaf, whether its value is
   * selected; for a parent, whether its whole subtree is. A parent that's only
   * partly selected draws as {@link partiallySelected} instead.
   */
  protected optionSelected(option: FilterOptionComponent): boolean {
    const values = this.subtreeValues(option);
    return values.length > 0 && values.every((value) => this.isSelected(value));
  }

  /** Whether some — but not all — of a parent's subtree is selected. */
  protected partiallySelected(option: FilterOptionComponent): boolean {
    const values = this.subtreeValues(option);
    return (
      values.some((value) => this.isSelected(value)) && !values.every((v) => this.isSelected(v))
    );
  }

  /**
   * Selecting a row selects everything beneath it, and clearing it clears the same
   * set — so a parent is a bulk control for its subtree rather than a value that can
   * drift out of step with its children.
   */
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
