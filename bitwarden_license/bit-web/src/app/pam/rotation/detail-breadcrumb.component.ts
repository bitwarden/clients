import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { BitwardenIcon, BreadcrumbsModule, IconTileComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** A crumb between the parent and the current page. */
export interface DetailBreadcrumbStep {
  readonly labelKey: string;
  /** Shown verbatim in place of {@link labelKey}, for a record's own name. */
  readonly label?: string;
  readonly route: unknown[];
  readonly tileIcon?: BitwardenIcon;
}

/**
 * Breadcrumb row for the rotation detail pages, projected into `bit-header`'s `breadcrumbs` slot.
 * The current page is the active crumb, which `bit-breadcrumbs` promotes to the page heading with
 * the header's title suffix beside it.
 */
@Component({
  selector: "pam-detail-breadcrumb",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BreadcrumbsModule, IconTileComponent, I18nPipe],
  // Fills the header's breadcrumb row, which `bit-breadcrumbs` measures to decide what to collapse.
  host: { class: "tw-flex tw-w-full tw-min-w-0" },
  template: `
    <bit-breadcrumbs>
      <bit-breadcrumb [route]="route()" [icon]="parentIcon()">{{
        parentLabelKey() | i18n
      }}</bit-breadcrumb>
      @if (step(); as step) {
        <bit-breadcrumb [route]="step.route">
          @if (step.tileIcon; as tileIcon) {
            <bit-icon-tile slot="start" [icon]="tileIcon" variant="brand" />
          }
          {{ step.label ?? (step.labelKey | i18n) }}
        </bit-breadcrumb>
      }
      <!-- The current URL, query string included, so the crumb reads as the active route. -->
      <bit-breadcrumb [route]="[]" queryParamsHandling="preserve">{{ current() }}</bit-breadcrumb>
    </bit-breadcrumbs>
  `,
})
export class DetailBreadcrumbComponent {
  /** Router link to the list this record came from. */
  readonly route = input.required<unknown[]>();

  readonly parentLabelKey = input.required<string>();

  readonly parentIcon = input<BitwardenIcon>();

  /** A crumb between the parent and the current page, for a page reached through another flow. */
  readonly step = input<DetailBreadcrumbStep>();

  /** The current page's own title, rendered verbatim. */
  readonly current = input.required<string>();
}
