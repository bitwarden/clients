import { AsyncPipe } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { Observable } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { BannerComponent } from "@bitwarden/components";

import {
  OrganizationWarningsService,
  ResellerRenewalWarning,
} from "../services/organization-warnings.service";

@Component({
  selector: "app-reseller-renewal-warning",
  template: `
    @let warning = resellerRenewalWarning$ | async;

    @if (warning) {
      <bit-banner
        id="reseller-warning-banner"
        class="-tw-m-6 tw-flex tw-flex-col tw-pb-6"
        icon="bwi-billing"
        bannerType="info"
        [showClose]="false"
      >
        {{ warning.message }}
      </bit-banner>
    }
  `,
  standalone: true,
  imports: [AsyncPipe, BannerComponent],
})
export class ResellerRenewalWarningComponent implements OnInit {
  @Input({ required: true }) organization!: Organization;

  resellerRenewalWarning$!: Observable<ResellerRenewalWarning>;

  constructor(private organizationWarningsService: OrganizationWarningsService) {}

  ngOnInit() {
    this.resellerRenewalWarning$ = this.organizationWarningsService.getResellerRenewalWarning$(
      this.organization,
    );
  }
}
