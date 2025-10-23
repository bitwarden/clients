import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgClass } from "@angular/common";
import { Component, HostBinding, OnInit, input } from "@angular/core";

import type { SortDirection, SortFn } from "./table-data-source";
import { TableComponent } from "./table.component";

@Component({
  selector: "th[bitSortable]",
  template: `
    <button
      type="button"
      [ngClass]="classList"
      [attr.aria-pressed]="isActive"
      (click)="setActive()"
    >
      <ng-content></ng-content>
      <i class="bwi tw-ms-2" [ngClass]="icon"></i>
    </button>
  `,
  imports: [NgClass],
})
export class SortableComponent implements OnInit {
  /**
   * Mark the column as sortable and specify the key to sort by
   */
  readonly bitSortable = input.required<string>();

  readonly default = input(false, {
    transform: (value: SortDirection | boolean | "") => {
      if (value === "desc" || value === "asc") {
        return value as SortDirection;
      } else {
        return coerceBooleanProperty(value) ? ("asc" as SortDirection) : false;
      }
    },
  });

  /**
   * Custom sorting function
   *
   * @example
   * fn = (a, b) => a.name.localeCompare(b.name)
   *
   * fn = (a, b, direction) => {
   *  const result = a.name.localeCompare(b.name)
   *  return direction === 'asc' ? result : -result;
   * }
   */
  readonly fn = input<SortFn>();

  constructor(private table: TableComponent) {}

  ngOnInit(): void {
    if (this.default() && !this.isActive) {
      this.setActive();
    }
  }

  @HostBinding("attr.aria-sort") get ariaSort() {
    if (!this.isActive) {
      return undefined;
    }
    return this.sort?.direction === "asc" ? "ascending" : "descending";
  }

  protected setActive() {
    const dataSource = this.table.dataSource();
    if (dataSource) {
      const defaultDirection = this.default() === "desc" ? "desc" : "asc";
      const direction = this.isActive
        ? this.direction === "asc"
          ? "desc"
          : "asc"
        : defaultDirection;

      dataSource.sort = {
        column: this.bitSortable(),
        direction: direction,
        fn: this.fn(),
      };
    }
  }

  private get sort() {
    return this.table.dataSource()?.sort;
  }

  get isActive() {
    return this.sort?.column === this.bitSortable();
  }

  get direction() {
    return this.sort?.direction;
  }

  get icon() {
    if (!this.isActive) {
      return "bwi-up-down-btn";
    }
    return this.direction === "asc" ? "bwi-up-solid" : "bwi-down-solid";
  }

  get classList() {
    return [
      "tw-min-w-max",
      "tw-font-medium",

      // Below is copied from BitIconButtonComponent
      "tw-border",
      "tw-border-solid",
      "tw-rounded",
      "tw-transition",
      "hover:tw-no-underline",
      "focus:tw-outline-none",

      "tw-bg-transparent",
      "!tw-text-muted",
      "tw-border-transparent",
      "hover:tw-bg-transparent-hover",
      "hover:tw-border-primary-700",
      "focus-visible:before:tw-ring-primary-700",
      "disabled:tw-opacity-60",
      "disabled:hover:tw-border-transparent",
      "disabled:hover:tw-bg-transparent",

      // Workaround for box-shadow with transparent offset issue:
      // https://github.com/tailwindlabs/tailwindcss/issues/3595
      // Remove `before:` and use regular `tw-ring` when browser no longer has bug, or better:
      // switch to `outline` with `outline-offset` when Safari supports border radius on outline.
      // Using `box-shadow` to create outlines is a hack and as such `outline` should be preferred.
      "tw-relative",
      "before:tw-content-['']",
      "before:tw-block",
      "before:tw-absolute",
      "before:-tw-inset-[3px]",
      "before:tw-rounded-md",
      "before:tw-transition",
      "before:tw-ring",
      "before:tw-ring-transparent",
      "focus-visible:tw-z-10",
    ];
  }
}
