import { DestroyRef, Directive, OnInit, inject } from "@angular/core";

import { FILTER_CONTROL } from "../../filter-menu/filter-tokens";

import { FILTER_HOST } from "./filter-host";

/**
 * Bridges a filter control to a filter host. Put `bitTableFilter` on a
 * `bit-filter-chip` / `bit-filter-toggle` projected into a `bit-table-v2`: the
 * directive reads the chip's {@link FILTER_CONTROL} (its key and aggregated value)
 * and registers it with the table's {@link FILTER_HOST}, so the chip's value lands
 * in the table's `filterValues` object and the applied-filter count.
 *
 * Registration happens in `ngOnInit`, not the constructor: the host's `table`
 * input is set during the view's update pass, after all constructors run, so
 * registering earlier would target the host's default (empty) model.
 *
 * Neither the chip nor this directive references the table type — both speak only
 * to the token contracts, so the chip stays usable outside any table. When
 * there's no host (the chip isn't inside a filterable surface), the directive is
 * inert.
 */
@Directive({
  selector: "[bitTableFilter]",
})
export class BitTableFilterDirective implements OnInit {
  private readonly host = inject(FILTER_HOST, { optional: true });
  private readonly control = inject(FILTER_CONTROL, { self: true, optional: true });
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const { control, host } = this;
    if (!control || !host) {
      return;
    }
    host.registerFilter(control);
    this.destroyRef.onDestroy(() => host.unregisterFilter(control));
  }
}
