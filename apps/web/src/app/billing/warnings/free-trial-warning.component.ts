import { AsyncPipe } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { Observable } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AnchorLinkDirective, BannerComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  FreeTrialWarning,
  OrganizationWarningsService,
} from "../services/organization-warnings.service";

@Component({
  selector: "app-free-trial-warning",
  template: `
    @let warning = freeTrialWarning$ | async;

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
export class FreeTrialWarningComponent implements OnInit {
  @Input({ required: true }) organization!: Organization;
  @Output() clicked = new EventEmitter<void>();

  freeTrialWarning$!: Observable<FreeTrialWarning>;

  constructor(private organizationWarningsService: OrganizationWarningsService) {}

  ngOnInit() {
    this.freeTrialWarning$ = this.organizationWarningsService.getFreeTrialWarning$(
      this.organization,
    );
  }
}
