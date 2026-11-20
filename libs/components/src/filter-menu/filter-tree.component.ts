import {
  ChangeDetectionStrategy,
  Component,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  viewChildren,
} from "@angular/core";

import { BerryComponent } from "../berry/berry.component";
import { CheckboxModule } from "../checkbox";
import { IconComponent } from "../icon";
import {
  IconTileComponent,
  IconTileVariant,
  resolveIconTileColor,
  resolveIconTileVariant,
} from "../icon-tile";
import { MenuDividerComponent } from "../menu/menu-divider.component";
import { menuItemBaseStyles, menuItemPrimaryStyles } from "../menu/menu-item.component";
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
    CheckboxModule,
    FilterTreeRowDirective,
    IconComponent,
    IconTileComponent,
    MenuDividerComponent,
    TooltipDirective,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: "tree",
    "aria-multiselectable": "true",
    "[attr.aria-label]": "label()",
    tabindex: "-1",
    // Grid so every row takes the widest row's width; deep rows scroll sideways with aligned counts.
    class: "tw-grid tw-min-h-0 tw-flex-1 tw-overflow-y-auto",
    "data-filter-card-list": "",
    "data-filter-scroll": "",
    "(keydown)": "onKeydown($event)",
  },
})
export class FilterTreeComponent {
  /** The rows to draw, flattened in document order, each carrying its own level. */
  readonly nodes = input.required<readonly FilterTreeNode[]>();

  /** The tree's accessible name. */
  readonly label = input.required<string>();

  protected readonly owner = inject<FilterTreeOwner>(FILTER_TREE_OWNER);

  protected readonly rowBaseClasses = filterRowBaseClasses;
  protected readonly optionRowClasses = filterOptionRowClasses;

  /** The rendered rows, in document order — the same order as {@link nodes}. */
  private readonly rows = viewChildren(FilterTreeRowDirective);

  /**
   * The row that last had focus, and where it was. Kept as the option rather than only its
   * position, since rows opening or closing above it move it.
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

  constructor() {
    // Row elements are reused by position, so rows opening above the focused one would leave
    // focus on whichever option took its place.
    afterRenderEffect(() => {
      const rows = this.rows();
      const index = this.activeIndex();
      const focused = rows.findIndex((row) => row.hasFocus());
      if (focused >= 0 && focused !== index) {
        rows[index]?.focus();
      }
    });
  }

  /**
   * Keys from the W3C's tree view pattern. Typeahead is left off: it is optional there, and the
   * menu already has a search field.
   *
   * CDK's `TreeKeyManager` isn't used. It needs an item object for every row, and it loses the
   * active row unless those objects are kept across each change to the list, which takes more
   * code than handling the keys directly. There are also a few bugs/workarounds required with CDK
   * that we can avoid with this custom approach.
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
  }

  protected onRowFocus(index: number): void {
    const node = this.nodes()[index];
    if (node) {
      this.active.set({ row: node.row, index });
    }
  }

  private focusIndex(index: number): void {
    this.onRowFocus(index);
    this.rows()[index]?.focus();
  }

  /** Focuses the row that last held focus, or the first. `false` when there is no row to take it. */
  focusActiveRow(): boolean {
    const index = this.activeIndex();
    this.focusIndex(index);
    return index >= 0;
  }

  protected tileVariant(option: FilterOptionRow): IconTileVariant {
    return resolveIconTileVariant(option.iconTile(), option.disabled());
  }

  protected tileColor(option: FilterOptionRow): string | undefined {
    return resolveIconTileColor(option.iconTile(), option.disabled());
  }

  /** Narrows a row to a section for the template (else `null`). */
  protected asSection(row: FilterRow): FilterSectionComponent | null {
    return row.kind === "section" ? (row as FilterSectionComponent) : null;
  }

  /** Narrows a row to an option for the template (else `null`). */
  protected asOption(row: FilterRow): FilterOptionRow | null {
    return row.kind === "option" ? (row as FilterOptionRow) : null;
  }
}
