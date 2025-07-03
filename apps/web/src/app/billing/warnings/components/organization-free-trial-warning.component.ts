import { AsyncPipe } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { Observable } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AnchorLinkDirective, BannerComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OrganizationWarningsService } from "../services";
import { OrganizationFreeTrialWarning } from "../types";

@Component({
  selector: "app-organization-free-trial-warning",
  template: `
    @let warning = warning$ | async;

    @if (warning) {
      <bit-banner
        id="free-trial-banner"
        class="-tw-m-6 tw-flex tw-flex-col tw-pb-6"
        icon="bwi-billing"
        bannerType="premium"
        [showClose]="false"
      >
        {{ warning.message }}
        <a
          bitLink
          linkType="secondary"
          (click)="clicked.emit()"
          class="tw-cursor-pointer"
          rel="noreferrer noopener"
        >
          {{ "clickHereToAddPaymentMethod" | i18n }}
        </a>
      </bit-banner>
    }
  `,
  imports: [AnchorLinkDirective, AsyncPipe, BannerComponent, I18nPipe],
})
export class OrganizationFreeTrialWarningComponent implements OnInit {
  @Input({ required: true }) organization!: Organization;
  @Output() clicked = new EventEmitter<void>();

  warning$!: Observable<OrganizationFreeTrialWarning>;

  constructor(private organizationWarningsService: OrganizationWarningsService) {}

  ngOnInit() {
    this.warning$ = this.organizationWarningsService.getFreeTrialWarning$(this.organization);
  }

  refresh = () => {
    this.warning$ = this.organizationWarningsService.getFreeTrialWarning$(this.organization, true);
  };
}
