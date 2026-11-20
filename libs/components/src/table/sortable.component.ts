import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { of, switchMap } from "rxjs";

import type { SortDirection, SortFn } from "./table-data-source";
import { TableComponent } from "./table.component";

@Component({
  selector: "th[bitSortable]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="classList"
      [attr.aria-pressed]="isActive()"
      (click)="setActive()"
    >
      <ng-content></ng-content>
      <i class="bwi tw-ms-2" [class]="icon()"></i>
    </button>
  `,
  host: {
    "[attr.aria-sort]": "ariaSort()",
  },
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

  private readonly table = inject(TableComponent);

  // Sort is shared across every header in the table, so each header must react when another
  // header changes it.
  private readonly sort = toSignal(
    toObservable(this.table.dataSource).pipe(switchMap((ds) => ds?.sort$ ?? of(undefined))),
  );

  protected readonly isActive = computed(() => this.sort()?.column === this.bitSortable());

  protected readonly ariaSort = computed(() => {
    if (!this.isActive()) {
      return undefined;
    }
    return this.sort()?.direction === "asc" ? "ascending" : "descending";
  });

  protected readonly icon = computed(() => {
    if (!this.isActive()) {
      return "bwi-up-down-btn";
    }
    return this.sort()?.direction === "asc" ? "bwi-up-solid" : "bwi-down-solid";
  });

  ngOnInit(): void {
    if (this.default() && !this.isCurrentlySorted()) {
      this.setActive();
    }
  }

  protected setActive() {
    const dataSource = this.table.dataSource();
    if (dataSource) {
      const defaultDirection = this.default() === "desc" ? "desc" : "asc";
      const direction = this.isCurrentlySorted()
        ? dataSource.sort.direction === "asc"
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

  /** Reads the data source synchronously; the `sort` signal lags until its first emission. */
  private isCurrentlySorted() {
    return this.table.dataSource()?.sort.column === this.bitSortable();
  }

  protected readonly classList = [
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
