import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * A page-level layout region for the main content area of a `bit-layout`.
 * Establishes a full-height flex column whose body fills the available height and
 * owns scrolling.
 *
 * Because the body is a bounded flex region, fill content dropped into it — e.g. a
 * `<bit-table-v2 height="fill">` — grows to the available height and scrolls
 * internally, rather than growing the page. Regular flowing content simply scrolls
 * in the body.
 *
 * @example
 * ```html
 * <bit-page>
 *   <bit-table-v2 [tableDef]="table" [virtualRowHeight]="64" height="fill">…columns…</bit-table-v2>
 * </bit-page>
 * ```
 */
@Component({
  selector: "bit-page",
  templateUrl: "./page.component.html",
  host: {
    class: "tw-flex tw-h-full tw-min-h-0 tw-flex-col tw-overflow-y-hidden",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageComponent {}
