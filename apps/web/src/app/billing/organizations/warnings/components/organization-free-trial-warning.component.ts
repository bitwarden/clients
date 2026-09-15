import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { combineLatest, filter, switchMap } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { BannerModule } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { OrganizationWarningsService } from "../services";

@Component({
  selector: "app-organization-free-trial-warning",
  template: `
    @let warning = warning$ | async;

    @if (warning) {
      <bit-banner id="free-trial-banner" icon="bwi-billing" variant="success">
        {{ warning.message }}
        @if (warning.isSalesAssisted) {
          {{ "freeTrialSalesAssistedContactRep" | i18n }}
        } @else {
          <a
            bitLink
            linkType="secondary"
            (click)="clicked.emit()"
            class="tw-cursor-pointer"
            rel="noreferrer noopener"
          >
            {{ "clickHereToAddPaymentMethod" | i18n }}
          </a>
        }
      </bit-banner>
    }
  `,
  imports: [BannerModule, SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationFreeTrialWarningComponent {
  readonly organization = input.required<Organization>();
  readonly includeOrganizationNameInMessaging = input(false);
  readonly clicked = output<void>();

  private readonly organizationWarningsService = inject(OrganizationWarningsService);

  protected readonly warning$ = combineLatest([
    toObservable(this.organization),
    toObservable(this.includeOrganizationNameInMessaging),
  ]).pipe(
    filter(([organization]) => organization != null),
    switchMap(([organization, includeOrganizationNameInMessaging]) =>
      this.organizationWarningsService.getFreeTrialWarning$(
        organization,
        includeOrganizationNameInMessaging,
      ),
    ),
  );
}
