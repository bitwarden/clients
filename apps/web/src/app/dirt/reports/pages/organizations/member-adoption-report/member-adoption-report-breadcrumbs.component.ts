import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { BreadcrumbsModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** The trail above the member adoption report's header: the organization's reports home, then this page. */
@Component({
  selector: "dirt-member-adoption-report-breadcrumbs",
  templateUrl: "./member-adoption-report-breadcrumbs.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BreadcrumbsModule, I18nPipe],
  host: {
    // `bit-breadcrumbs` sizes itself to its container, so this wrapper has to be one.
    class: "tw-flex tw-w-full tw-min-w-0",
  },
})
export class MemberAdoptionReportBreadcrumbsComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((params) => params.organizationId as OrganizationId | undefined)),
  );

  /**
   * Absolute commands for the organization's reports home. Relative commands resolve against the
   * router state root rather than this page, so the organization id is spelled out.
   */
  protected readonly reportsRoute = computed<string[] | undefined>(() => {
    const organizationId = this.organizationId();

    if (organizationId == null) {
      return undefined;
    }

    return ["/organizations", organizationId, "reporting", "reports"];
  });
}
