import { TreeKeyManager } from "@angular/cdk/a11y";
import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
  input,
  viewChildren,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

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
  FILTER_TREE_HOST,
  FILTER_TREE_OWNER,
  FilterOptionRow,
  FilterRow,
  FilterTreeHost,
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
  providers: [{ provide: FILTER_TREE_HOST, useExisting: forwardRef(() => FilterTreeComponent) }],
})
export class FilterTreeComponent implements FilterTreeHost {
  /** The rows to draw, flattened in document order, each carrying its own level. */
  readonly nodes = input.required<readonly FilterTreeNode[]>();

  /** The tree's accessible name. */
  readonly label = input.required<string>();

  protected readonly owner = inject<FilterTreeOwner>(FILTER_TREE_OWNER);

  protected readonly rowBaseClasses = filterRowBaseClasses;
  protected readonly optionRowClasses = filterOptionRowClasses;

  /** The rendered rows, in document order — the same order as {@link nodes}. */
  private readonly rows = viewChildren(FilterTreeRowDirective);

  // Typeahead is left off — optional for a tree, and the menu already has a search field.
  private readonly keyManager = new TreeKeyManager<FilterTreeRowDirective>(
    toObservable(this.rows).pipe(map((rows) => [...(rows as readonly FilterTreeRowDirective[])])),
    {
      // Rows are re-created as the tree expands, so key on the declaration behind each.
      trackBy: (row) => {
        const node = row.node();
        return node.row;
      },
    },
  );

  protected onKeydown(event: KeyboardEvent): void {
    this.keyManager.onKeydown(event);
  }

  protected onRowFocus(row: FilterTreeRowDirective): void {
    this.keyManager.focusItem(row);
  }

  /** Focuses the row that last held focus, or the first. `false` when there is no row to take it. */
  focusActiveRow(): boolean {
    const row = this.keyManager.getActiveItem() ?? this.rows()[0];
    row?.focus();
    return row != null;
  }

  /** @see FilterTreeHost.activateNode */
  activateNode(node: FilterTreeNode): void {
    this.owner.activateNode(node);
  }

  /** @see FilterTreeHost.parentRow */
  parentRow<T>(row: T): T | null {
    const rows = this.rows();
    const parent = rows[rows.indexOf(row as never)]?.node().parent;
    return parent == null ? null : (rows[parent] as never);
  }

  /** @see FilterTreeHost.childRows */
  childRows<T>(row: T): T[] {
    const rows = this.rows();
    const index = rows.indexOf(row as never);
    return index < 0 ? [] : (rows.filter((r) => r.node().parent === index) as never);
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
