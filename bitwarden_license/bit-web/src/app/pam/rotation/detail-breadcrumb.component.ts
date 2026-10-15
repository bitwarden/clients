import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import {
  BitwardenIcon,
  BreadcrumbsModule,
  IconTileComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** A crumb between the parent and the current page. */
export interface DetailBreadcrumbStep {
  readonly labelKey: string;
  readonly route: unknown[];
  readonly tileIcon?: BitwardenIcon;
}

/**
 * Breadcrumb row for the rotation detail pages, projected into `bit-header`'s `breadcrumbs` slot.
 * The parent crumb is never the active route, so `bit-breadcrumbs` leaves the `<h1>` to the header.
 */
@Component({
  selector: "pam-detail-breadcrumb",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BreadcrumbsModule, IconTileComponent, TypographyModule, I18nPipe],
  template: `
    <div class="tw-flex tw-min-w-0 tw-items-baseline">
      <!-- \`bit-breadcrumbs\`' host is \`tw-w-full\`; this wrapper sizes it to its content, so the
           static crumb below stays next to it instead of at the row's far edge. -->
      <div class="tw-min-w-0" [class.tw-shrink-0]="truncate()">
        <bit-breadcrumbs showTrailingArrow>
          <bit-breadcrumb [route]="route()" [icon]="parentIcon()">{{
            parentLabelKey() | i18n
          }}</bit-breadcrumb>
          @if (step(); as step) {
            <bit-breadcrumb [route]="step.route">
              @if (step.tileIcon; as tileIcon) {
                <bit-icon-tile slot="start" [icon]="tileIcon" variant="brand" />
              }
              {{ step.labelKey | i18n }}
            </bit-breadcrumb>
          }
        </bit-breadcrumbs>
      </div>
      <!-- A route-less bit-breadcrumb falls back to a focusable button that does nothing and never
           gets aria-current; a static span carries the current-page semantics without that trap. -->
      <span
        bitTypography="h3"
        aria-current="page"
        class="tw-inline-flex tw-items-center tw-gap-2 !tw-m-0 !tw-text-fg-heading"
        [class.tw-min-w-0]="truncate()"
        [class.tw-shrink-0]="!truncate()"
        [class.tw-whitespace-nowrap]="!truncate()"
      >
        @if (currentTileIcon(); as tileIcon) {
          <bit-icon-tile [icon]="tileIcon" variant="brand" size="sm" />
        }
        <span [class.tw-truncate]="truncate()">{{ current() }}</span>
      </span>
    </div>
  `,
})
export class DetailBreadcrumbComponent {
  /** Router link to the list this record came from. */
  readonly route = input.required<unknown[]>();

  readonly parentLabelKey = input.required<string>();

  readonly parentIcon = input<BitwardenIcon>();

  /** A crumb between the parent and the current page, for a page reached through another flow. */
  readonly step = input<DetailBreadcrumbStep>();

  /** Shows the current page's title after a brand icon tile. */
  readonly currentTileIcon = input<BitwardenIcon>();

  /** The current page's own title, rendered verbatim. */
  readonly current = input.required<string>();

  /** Truncate the current page's title rather than letting it set the row's width. */
  readonly truncate = input(false);
}
