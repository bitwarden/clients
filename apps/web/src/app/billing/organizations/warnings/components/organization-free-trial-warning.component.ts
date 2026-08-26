import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { Observable, of, switchMap } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { BannerModule } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { OrganizationWarningsService } from "../services";
import { OrganizationFreeTrialWarning } from "../types";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-organization-free-trial-warning",
  template: `
    @let warning = warning$ | async;

    @if (warning) {
      <bit-banner id="free-trial-banner" icon="bwi-billing" variant="success">
        {{ warning.message }}
        @if (!(isGovMode$ | async)) {
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
})
export class OrganizationFreeTrialWarningComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) organization!: Organization;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() includeOrganizationNameInMessaging = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() clicked = new EventEmitter<void>();

  warning$!: Observable<OrganizationFreeTrialWarning | null>;
  isGovMode$!: Observable<boolean>;

  constructor(
    private organizationWarningsService: OrganizationWarningsService,
    private govModeService: GovModeService,
    private accountService: AccountService,
  ) {}

  ngOnInit() {
    this.warning$ = this.organizationWarningsService.getFreeTrialWarning$(
      this.organization,
      this.includeOrganizationNameInMessaging,
    );
    this.isGovMode$ = this.accountService.activeAccount$.pipe(
      getOptionalUserId,
      switchMap((userId) => (userId == null ? of(false) : this.govModeService.isGovMode$(userId))),
    );
  }
}
