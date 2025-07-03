import { AsyncPipe } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { Observable } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { BannerComponent } from "@bitwarden/components";

import { OrganizationWarningsService } from "../services";
import { OrganizationResellerRenewalWarning } from "../types";

@Component({
  selector: "app-organization-reseller-renewal-warning",
  template: `
    @let warning = warning$ | async;

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
  imports: [AsyncPipe, BannerComponent],
})
export class OrganizationResellerRenewalWarningComponent implements OnInit {
  @Input({ required: true }) organization!: Organization;

  warning$!: Observable<OrganizationResellerRenewalWarning>;

  constructor(private organizationWarningsService: OrganizationWarningsService) {}

  ngOnInit() {
    this.warning$ = this.organizationWarningsService.getResellerRenewalWarning$(this.organization);
  }
}
