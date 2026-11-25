import {
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
  CdkVirtualScrollable,
  VIRTUAL_SCROLLABLE,
  VIRTUAL_SCROLL_STRATEGY,
} from "@angular/cdk/scrolling";
import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Signal,
  afterRenderEffect,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from "@angular/core";
import { Observable, fromEvent } from "rxjs";

import { BerryComponent } from "../berry/berry.component";
import { CheckboxModule } from "../checkbox";
import { IconComponent } from "../icon";
import {
  IconTileComponent,
  IconTileOptions,
  IconTileVariant,
  resolveIconTileColor,
  resolveIconTileVariant,
} from "../icon-tile";
import { MenuDividerComponent } from "../menu/menu-divider.component";
import { menuItemBaseStyles, menuItemPrimaryStyles } from "../menu/menu-item.component";
import { getRootFontSizePx, remToPx } from "../shared/root-font-size";
import { VariableHeightVirtualScrollStrategy } from "../shared/variable-height-virtual-scroll.strategy";
import { TooltipDirective } from "../tooltip";
import { TypographyModule } from "../typography";

import type { FilterSectionComponent } from "./filter-section.component";
import {
  FILTER_TREE_OWNER,
  FilterOptionRow,
  FilterRow,
  FilterTreeNode,
  FilterTreeOwner,
} from "./filter-tokens";
import { FilterTreeRowDirective } from "./filter-tree-row.directive";

/**
 * `bitMenuItem`'s look plus the flex layout, shared by every row of a `bit-filter-menu`.
 * Section headers use it as-is; option rows use {@link filterOptionRowClasses}.
 */
export const filterRowBaseClasses = [
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
  "has-[:disabled]:hover:tw-bg-bg-primary",
  "has-[:disabled]:!tw-text-fg-inactive",
];

/** An option row is 48px against a section header's 40px. */
export const filterOptionRowClasses = [...filterRowBaseClasses, "tw-py-3"];

/**
 * Row heights in rem, as the classes above draw them. A virtualized tree positions rows from
 * these rather than measuring them, so each row is also pinned to its height.
 */
const OPTION_ROW_REM = 3;
const SECTION_ROW_REM = 2.5;
/** `bit-menu-divider`: a 1px rule with a 0.5rem margin above and below. */
const DIVIDER_REM = 1;
const DIVIDER_RULE_PX = 1;
/** The menu's padding, which the list's scroll area extends into. */
const LIST_INSET_REM = 0.5;
/** The space between two groups where each is drawn as a card. */
const CARD_GAP_REM = 0.75;

/** How many of the widest rows size a virtualized tree's popover. */
const SIZER_ROWS = 3;
/** Roughly how many characters of label one level of indent is as wide as. */
const INDENT_AS_CHARACTERS = 4;

/** What a row shows that comes from signals — its own, and the chip's selection and counts. */
type FilterTreeRowState = {
  expandable: boolean;
  disabled: boolean;
  label: string;
  /** `null` for a section header, which isn't selectable. */
  checked: "true" | "false" | "mixed" | null;
  tile?: {
    icon: IconTileOptions["icon"];
    emphasis: NonNullable<IconTileOptions["emphasis"]>;
    variant: IconTileVariant;
    color: string | undefined;
  };
  /** An option's trailing count. */
  count?: number;
  /** A section header's berry. */
  sectionSelectedCount?: number;
};

/**
 * Lets a viewport be scrolled by an element outside it, as `bitScrollLayout` does for a page.
 *
 * Avoids: CDK's own `cdkVirtualScrollingElement`. It adds size containment to the scrolling
 * element, which would collapse one that takes its height from its content.
 */
class OuterScrollable extends CdkVirtualScrollable {
  constructor(element: HTMLElement) {
    super();
    this.elementRef = new ElementRef(element);
  }

  override elementScrolled(): Observable<Event> {
    return new Observable((subscriber) =>
      this.ngZone.runOutsideAngular(() =>
        fromEvent(this.elementRef.nativeElement, "scroll").subscribe(subscriber),
      ),
    );
  }

  override measureBoundingClientRectWithScrollOffset(
    from: "left" | "top" | "right" | "bottom",
  ): number {
    return (
      this.elementRef.nativeElement.getBoundingClientRect()[from] - this.measureScrollOffset(from)
    );
  }
}

/**
 * The rows of a multi-select `bit-filter-menu`, as an ARIA tree. The chip owns the selection
 * and decides which rows there are; this draws them and moves focus between them.
 *
 * @internal
 */
@Component({
  selector: "bit-filter-tree",
  templateUrl: "./filter-tree.component.html",
  imports: [
    BerryComponent,
    CdkVirtualForOf,
    CdkVirtualScrollViewport,
    CheckboxModule,
    FilterTreeRowDirective,
    IconComponent,
    IconTileComponent,
    MenuDividerComponent,
    NgTemplateOutlet,
    TooltipDirective,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: "tree",
    "aria-multiselectable": "true",
    "[attr.aria-label]": "label()",
    "[tabindex]": "tabbable() ? 0 : -1",
    "[class]": "hostClasses()",
    "data-filter-card-list": "",
    "[attr.data-filter-scroll]": "virtualized() ? null : ''",
    "(keydown)": "onKeydown($event)",
    "(focus)": "onFocus()",
  },
  providers: [
    // The virtual-scroll viewport in the template picks up the tree's own strategy.
    {
      provide: VIRTUAL_SCROLL_STRATEGY,
      useFactory: (tree: FilterTreeComponent) => tree.scrollStrategy,
      deps: [forwardRef(() => FilterTreeComponent)],
    },
    // `null` leaves the viewport to scroll itself.
    {
      provide: VIRTUAL_SCROLLABLE,
      useFactory: (tree: FilterTreeComponent) => {
        const element = tree.scrollElement();
        return element ? new OuterScrollable(element) : null;
      },
      deps: [forwardRef(() => FilterTreeComponent)],
    },
  ],
})
export class FilterTreeComponent {
  /** The rows to draw, flattened in document order, each carrying its own level. */
  readonly nodes = input.required<readonly FilterTreeNode[]>();

  /** The tree's accessible name. */
  readonly label = input.required<string>();

  /** Renders only the rows in view, for a list too long to render whole. */
  readonly virtualized = input(false);

  /**
   * Whether a search is narrowing {@link nodes}. A virtualized tree holds its width while one is.
   */
  readonly searching = input(false);

  /**
   * The element that scrolls the tree, where that is something around it rather than the tree
   * itself. Read once, as the viewport is created.
   */
  readonly scrollElement = input<HTMLElement>();

  /** Whether the surface draws each group as a card, with a gap between them and no dividers. */
  readonly cards = input(false);

  protected readonly owner = inject<FilterTreeOwner>(FILTER_TREE_OWNER);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly hostClasses = computed(() =>
    this.virtualized()
      ? // A column, so the viewport can shrink to the space the menu leaves it. No focus ring:
        // the tree only holds focus for a row scrolled out of view, and a ring around the
        // whole list while scrolling is more disruptive than informative.
        [
          "tw-flex",
          "tw-min-h-0",
          "tw-flex-1",
          "tw-flex-col",
          "tw-outline-none",
          // Scrolled from outside, the viewport clips nothing, so deep rows scroll sideways here.
          ...(this.scrollElement() ? ["tw-overflow-x-auto"] : []),
        ]
      : // Grid so every row takes the widest row's width; deep rows scroll sideways with aligned counts.
        ["tw-grid", "tw-min-h-0", "tw-flex-1", "tw-overflow-y-auto"],
  );

  protected readonly optionRowClasses = computed(() =>
    this.virtualized()
      ? [...filterOptionRowClasses, "tw-box-border", "tw-h-12"]
      : filterOptionRowClasses,
  );

  protected readonly sectionRowClasses = computed(() =>
    this.virtualized()
      ? [...filterRowBaseClasses, "tw-box-border", "tw-h-10"]
      : filterRowBaseClasses,
  );

  /** Read once per tree, which lives only as long as its menu is open. */
  private readonly rootFontSizePx = getRootFontSizePx();

  /** Each row's height in pixels, divider included, for {@link scrollStrategy}. */
  private readonly rowHeights = computed(() =>
    this.virtualized()
      ? this.nodes().map((node, index) => {
          const row = remToPx(
            node.row.kind === "section" ? SECTION_ROW_REM : OPTION_ROW_REM,
            this.rootFontSizePx,
          );
          if (this.cards()) {
            return this.hasCardGap(node, index)
              ? row + remToPx(CARD_GAP_REM, this.rootFontSizePx)
              : row;
          }
          return node.dividerBefore
            ? row + remToPx(DIVIDER_REM, this.rootFontSizePx) + DIVIDER_RULE_PX
            : row;
        })
      : [],
  );

  protected readonly cardGapRem = CARD_GAP_REM;

  /** Provided to the viewport through `VIRTUAL_SCROLL_STRATEGY`. */
  readonly scrollStrategy = new VariableHeightVirtualScrollStrategy(this.rowHeights);

  /**
   * The viewport's height: that of the whole list, which the menu then shrinks to the space it
   * has. `null` when something outside scrolls the tree, where CDK sizes the viewport itself.
   *
   * Avoids: a viewport with no height. Its rows are out of flow, so they would give it none.
   */
  protected readonly viewportHeight = computed(() =>
    this.scrollElement()
      ? null
      : this.rowHeights().reduce((sum, height) => sum + height, 0) +
        remToPx(LIST_INSET_REM, this.rootFontSizePx),
  );

  /**
   * In the menu, extends the scroll area into the menu's padding, as the plain list does, so
   * the scrollbar reaches the popover's edge. The rows' inset goes on CDK's content wrapper.
   *
   * Avoids: padding on the viewport itself, which its absolutely positioned rows would ignore.
   */
  protected readonly viewportClasses = computed(() =>
    this.scrollElement()
      ? []
      : [
          "-tw-mx-2",
          "-tw-mb-2",
          "tw-min-h-0",
          "[&>.cdk-virtual-scroll-content-wrapper]:tw-box-border",
          "[&>.cdk-virtual-scroll-content-wrapper]:tw-px-2",
          "[&>.cdk-virtual-scroll-content-wrapper]:tw-pb-2",
        ],
  );

  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  /**
   * The rows most likely to be the widest, picked by label length and indent. The pick is kept
   * as it is while a search is running.
   *
   * Avoids: measuring every row to find the widest, which would mean rendering them all; and
   * the popover resizing with each keystroke of a search.
   */
  protected readonly sizerNodes = linkedSignal<
    { nodes: readonly FilterTreeNode[]; searching: boolean },
    readonly FilterTreeNode[]
  >({
    source: () => ({ nodes: this.nodes(), searching: this.searching() }),
    computation: ({ nodes, searching }, previous) => {
      if (searching && previous) {
        return previous.value;
      }
      return nodes
        .map((node) => ({
          node,
          width: node.row.label().length + (node.indent - 1) * INDENT_AS_CHARACTERS,
        }))
        .sort((a, b) => b.width - a.width)
        .slice(0, SIZER_ROWS)
        .map(({ node }) => node);
    },
  });

  /**
   * The most indented row. It is always drawn, hidden, inside the viewport, so every row there
   * is as wide as this one needs and deep rows scroll sideways with their counts aligned.
   *
   * Avoids: the sideways scroll width following whichever rows are rendered, which would shift
   * as deep rows scroll in and out.
   */
  protected readonly deepestNode = computed(() =>
    this.nodes().reduce<FilterTreeNode | undefined>(
      (deepest, node) => (deepest && deepest.indent >= node.indent ? deepest : node),
      undefined,
    ),
  );

  /** A sizer row is no row of the list, so it takes a position no row of the list has. */
  protected readonly sizerIndex = -1;

  /**
   * Identifies each row of the virtualized list by its position, as the plain list's
   * `track $index` does. Angular passes a trackBy function the position and then the item;
   * this takes only the position, so the item is deliberately ignored. A row element is kept
   * for as long as its position is rendered, and only its contents change.
   *
   * Avoids: identifying rows by item. The items are rebuilt whenever the list changes, so that
   * would destroy and re-create every rendered row on each change, including the row that has
   * focus, and focus would be lost.
   */
  protected readonly trackByIndex = (index: number) => index;

  /** The rendered rows. A virtualized tree renders only those in or near view. */
  private readonly rows = viewChildren(FilterTreeRowDirective);

  private readonly rowStates = new WeakMap<FilterRow, Signal<FilterTreeRowState>>();

  /**
   * Returns what a row shows. Each row's values are read inside a `computed` of that row's own,
   * created on first use and kept for as long as the row exists. A `computed` has its own short
   * list of the signals it depends on, so the cost of reading a row doesn't grow with the tree.
   *
   * Avoids: the template reading a row's signals directly. Every row is drawn in this
   * component's one view, so those reads would all land on one long dependency list. When a
   * view reads a signal it has already read, Angular walks that list to find it. A row reading
   * its own signals twice would then cost in proportion to the rows before it, and drawing the
   * whole tree in proportion to the square of its length.
   */
  protected rowState(node: FilterTreeNode): FilterTreeRowState {
    const row = node.row;
    let state = this.rowStates.get(row);
    if (!state) {
      state = computed(() => this.readRowState(row));
      this.rowStates.set(row, state);
    }
    return state();
  }

  private readRowState(row: FilterRow): FilterTreeRowState {
    const state: FilterTreeRowState = {
      expandable: row.expandable(),
      disabled: row.disabled(),
      label: row.label(),
      checked: this.owner.rowChecked(row),
    };
    if (row.kind === "section") {
      state.sectionSelectedCount = this.owner.sectionSelectedCount(row as FilterSectionComponent);
      return state;
    }
    const option = row as FilterOptionRow;
    const tile = option.iconTile();
    if (tile) {
      state.tile = {
        icon: tile.icon,
        emphasis: tile.emphasis ?? "subtle",
        variant: resolveIconTileVariant(tile, state.disabled),
        color: resolveIconTileColor(tile, state.disabled),
      };
    }
    state.count = this.owner.optionCounts().get(option);
    return state;
  }

  /**
   * The row that last had focus, held as the option itself along with its position.
   *
   * Avoids: holding only the position, which would point at a different option whenever rows
   * open or close above it.
   */
  private readonly active = signal<{ row: FilterRow; index: number } | null>(null);

  /**
   * The position of the row holding the tree's single tab stop, or `-1` with no rows. Follows
   * the active option; if that option is gone it holds its position, and failing that it
   * falls to the first enabled row, which is also where a newly opened tree starts.
   */
  protected readonly activeIndex = computed(() => {
    const nodes = this.nodes();
    const active = this.active();
    if (active) {
      const index = nodes.findIndex((node) => node.row === active.row);
      if (index >= 0) {
        return index;
      }
      if (active.index < nodes.length) {
        return active.index;
      }
    }
    return nodes.length === 0
      ? -1
      : Math.max(
          nodes.findIndex((n) => !n.row.disabled()),
          0,
        );
  });

  /**
   * If the active focused item scrolls out of view and is un-rendered, the tree takes focus as a
   * stopgap measure so that the Tab key always has somewhere in the list to land.
   */
  protected readonly tabbable = computed(
    () => this.virtualized() && this.activeIndex() >= 0 && !this.rowAt(this.activeIndex()),
  );

  /**
   * Set while the active row is being scrolled into the rendered range to take focus. The
   * row's position is looked up when it is needed.
   *
   * Avoids: storing the position to focus. The key that asked for it may also open rows above
   * the active one, which would leave a stored position pointing at a different row.
   */
  private readonly revealing = signal(false);

  /** Whether a row has focus, as far as the tree has been told: cleared by any blur. */
  private readonly rowFocused = signal(false);

  /** Set while the tree moves focus to itself, to tell that apart from the user tabbing in. */
  private readonly takingFocus = signal(false);

  constructor() {
    // Tells the strategy when row heights change. CDK only tells it when the number of rows
    // changes, so on its own it would miss heights changing while the count stays the same.
    effect(() => {
      this.rowHeights();
      this.scrollStrategy.refresh();
    });

    // Re-measures the viewport whenever it, or the element scrolling it, changes size. CDK only
    // re-measures when the window resizes, which would miss the list being searched and rows
    // opening and closing.
    effect((onCleanup) => {
      const viewport = this.viewport();
      if (!viewport) {
        return;
      }
      const observer = new ResizeObserver(() => viewport.checkViewportSize());
      observer.observe(this.scrollElement() ?? viewport.elementRef.nativeElement);
      onCleanup(() => observer.disconnect());
    });

    afterRenderEffect(() => {
      const rows = this.rows();
      const index = this.activeIndex();
      const revealing = this.revealing();
      const focused = rows.find((row) => row.hasFocus());

      if (revealing) {
        const row = this.rowAt(index);
        if (row) {
          untracked(() => this.revealing.set(false));
          row.focus();
        } else {
          // Not there yet, or the list changed and moved it: scroll to where it is now.
          untracked(() => this.scrollToRow(index));
        }
        return;
      }

      if (focused) {
        // Moves focus to the active option's row if it is on a different one. Row elements are
        // reused by position, so without this, rows opening above the focused one would leave
        // focus on whichever option took its place.
        if (focused.index() !== index) {
          this.rowAt(index)?.focus();
        }
        return;
      }

      // Moves focus onto the tree when the focused row was removed and no blur event reported
      // it. `onRowBlur` handles a browser that does send one. Without either, focus would be
      // left on the document and the keyboard would stop working in the list.
      if (this.rowFocused() && document.activeElement === document.body) {
        untracked(() => this.focusTree());
        return;
      }

      // The tree only holds focus on a row's behalf, so hand it back once that row is rendered
      // again. Without scrolling: the user is the one scrolling it into view.
      if (document.activeElement === this.el.nativeElement) {
        this.rowAt(index)?.focus({ preventScroll: true });
      }
    });
  }

  private rowAt(index: number): FilterTreeRowDirective | undefined {
    return this.rows().find((row) => row.index() === index);
  }

  /**
   * Keys from the W3C's tree view pattern. Typeahead is left off: it is optional there, and the
   * menu already has a search field.
   *
   * Avoids: CDK's `TreeKeyManager`. It would need an item object for every row, and it loses
   * the active row unless those objects are kept across each change to the list, which takes
   * more code than handling the keys directly. It would also need workarounds for a few of its
   * own behaviours, such as treating a row with no children as expandable.
   */
  protected onKeydown(event: KeyboardEvent): void {
    const nodes = this.nodes();
    const index = this.activeIndex();
    const node = nodes[index];
    if (!node) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        this.focusIndex(Math.min(index + 1, nodes.length - 1));
        break;
      case "ArrowUp":
        this.focusIndex(Math.max(index - 1, 0));
        break;
      case "Home":
        this.focusIndex(0);
        break;
      case "End":
        this.focusIndex(nodes.length - 1);
        break;
      case "ArrowRight":
        if (node.row.expandable() && !node.expanded) {
          node.row.toggleExpanded();
        } else if (nodes[index + 1]?.parent === index) {
          this.focusIndex(index + 1);
        }
        break;
      case "ArrowLeft":
        if (node.row.expandable() && node.expanded) {
          node.row.toggleExpanded();
        } else if (node.parent != null) {
          this.focusIndex(node.parent);
        }
        break;
      case "Enter":
      case " ":
        if (!node.row.disabled()) {
          this.owner.activateNode(node);
        }
        break;
      case "*":
        for (const sibling of nodes) {
          if (sibling.parent === node.parent && sibling.row.expandable() && !sibling.expanded) {
            sibling.row.toggleExpanded();
          }
        }
        break;
      default:
        return;
    }
    event.preventDefault();

    // A key acts on the active row whether or not it is in view. If it was scrolled out of sight,
    // bring it back as well.
    if (!this.rowAt(this.activeIndex())) {
      this.revealActiveRow();
    }
  }

  protected onRowFocus(index: number): void {
    const node = this.nodes()[index];
    if (node) {
      this.active.set({ row: node.row, index });
      this.rowFocused.set(this.rowAt(index)?.hasFocus() ?? false);
      this.revealing.set(false);
    }
  }

  /**
   * Records that the row no longer has focus. If the blur came from the row being removed, as
   * happens when it scrolls out of the rendered range, also moves focus onto the tree. That
   * check runs a moment later, in a microtask.
   *
   * Avoids: checking at the time of the blur. The browser sends the blur while the row is still
   * in the page, so a removal would look the same as focus leaving on purpose.
   */
  protected onRowBlur(event: FocusEvent): void {
    this.rowFocused.set(false);
    if (event.relatedTarget) {
      return;
    }
    const row = event.target as HTMLElement;
    queueMicrotask(() => {
      if (!row.isConnected && document.activeElement === document.body) {
        this.focusTree();
      }
    });
  }

  /** Tab reached the tree itself, so its active row is out of view: bring it back and focus it. */
  protected onFocus(): void {
    if (!this.takingFocus() && this.el.nativeElement.matches(":focus-visible")) {
      this.focusIndex(this.activeIndex());
    }
  }

  private focusTree(): void {
    this.rowFocused.set(false);
    this.takingFocus.set(true);
    this.el.nativeElement.focus({ preventScroll: true });
    this.takingFocus.set(false);
  }

  private focusIndex(index: number): void {
    const node = this.nodes()[index];
    if (!node) {
      return;
    }
    this.active.set({ row: node.row, index });

    const row = this.rowAt(index);
    if (row) {
      row.focus();
      return;
    }
    this.revealActiveRow();
  }

  /**
   * Scrolls the active row into the rendered range and focuses it once it exists, holding focus
   * on the tree in the meantime.
   */
  private revealActiveRow(): void {
    this.revealing.set(true);
    this.focusTree();
    this.scrollToRow(this.activeIndex());
  }

  /**
   * Puts a row at the top of the scroll area, allowing for anything that sits above the list.
   *
   * Avoids: the viewport's own `scrollToIndex`. When something outside the viewport does the
   * scrolling, it leaves out whatever is above the list, so the row would land short.
   */
  private scrollToRow(index: number): void {
    const viewport = this.viewport();
    if (!viewport) {
      return;
    }
    const offset = this.rowHeights()
      .slice(0, index)
      .reduce((sum, height) => sum + height, 0);
    viewport.scrollToOffset(offset + viewport.measureViewportOffset());
  }

  /** Whether a gap follows this row: it ends a card, and another card comes after it. */
  protected hasCardGap(node: FilterTreeNode, index: number): boolean {
    return node.groupEnd && index < this.nodes().length - 1;
  }

  /** Focuses the row that last held focus, or the first. `false` when there is no row to take it. */
  focusActiveRow(): boolean {
    const index = this.activeIndex();
    this.focusIndex(index);
    return index >= 0;
  }
}
