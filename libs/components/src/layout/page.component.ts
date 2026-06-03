import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * A page-level layout region for the main content area of a `bit-layout`.
 * Establishes a full-height flex column: a fixed `[slot=header]` and `[slot=footer]`
 * that don't scroll, and a body (default slot) that fills the remaining height and
 * owns scrolling.
 *
 * Because the body is a bounded flex region, fill content dropped into it — e.g. a
 * `<bit-table-v2 fill>` — grows to the available height and scrolls internally,
 * rather than growing the page. Regular flowing content simply scrolls in the body.
 *
 * @example
 * ```html
 * <bit-page>
 *   <h1 slot="header" bitTypography="h1">Members</h1>
 *   <bit-table-v2 [table]="table" [virtualRowHeight]="64" fill>…columns…</bit-table-v2>
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
