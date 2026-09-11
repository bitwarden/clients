import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { BreadcrumbsModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * The breadcrumb row shared by the rotation feature's three detail pages: the list this record
 * came from, then the record itself as the current page.
 *
 * Project it into `bit-header`'s `breadcrumbs` slot and leave the page's `<h1>` to the header's
 * `title` input:
 *
 * ```html
 * <bit-header [title]="titleText()" icon="bwi-desktop">
 *   <pam-detail-breadcrumb
 *     slot="breadcrumbs"
 *     [route]="['..']"
 *     parentLabelKey="pamRotationTabTargetSystems"
 *     [current]="titleText()"
 *   />
 * </bit-header>
 * ```
 *
 * The row is the trail, not the heading. `bit-breadcrumbs` only promotes a crumb to the `<h1>`
 * when one of its crumbs is the active route, and the parent crumb here never is, so the header
 * keeps rendering the heading and `current` restates the record name at the end of the trail.
 */
@Component({
  selector: "pam-detail-breadcrumb",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BreadcrumbsModule, TypographyModule, I18nPipe],
  template: `
    <div class="tw-flex tw-min-w-0 tw-items-baseline">
      <!-- \`bit-breadcrumbs\`' host carries \`tw-w-full\`, sized against its own containing block; this
           wrapper gives it one shaped to its content instead of the whole row, so the static crumb
           below stays in flow next to it rather than being pushed to the row's far edge. -->
      <div class="tw-min-w-0" [class.tw-shrink-0]="truncate()">
        <bit-breadcrumbs showTrailingArrow>
          <bit-breadcrumb [route]="route()">{{ parentLabelKey() | i18n }}</bit-breadcrumb>
        </bit-breadcrumbs>
      </div>
      <!-- A route-less bit-breadcrumb falls back to a focusable button that does nothing and never
           gets aria-current; a static span carries the current-page semantics without that trap. -->
      <span
        bitTypography="h3"
        aria-current="page"
        class="tw-inline-block !tw-m-0 !tw-text-fg-heading"
        [class.tw-min-w-0]="truncate()"
        [class.tw-truncate]="truncate()"
        [class.tw-shrink-0]="!truncate()"
        [class.tw-whitespace-nowrap]="!truncate()"
        >{{ current() }}</span
      >
    </div>
  `,
})
export class DetailBreadcrumbComponent {
  /** Router link to the list this record came from. */
  readonly route = input.required<unknown[]>();

  /** i18n key naming that list. */
  readonly parentLabelKey = input.required<string>();

  /** The current page's own title, rendered verbatim. */
  readonly current = input.required<string>();

  /** Truncate the current page's title rather than letting it set the row's width. */
  readonly truncate = input(false);
}
