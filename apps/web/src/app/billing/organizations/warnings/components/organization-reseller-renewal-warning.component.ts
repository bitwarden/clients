import { Component, Input, OnInit } from "@angular/core";
import { Observable } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { BannerModule } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { OrganizationWarningsService } from "../services";
import { OrganizationResellerRenewalWarning } from "../types";

@Component({
  selector: "app-organization-reseller-renewal-warning",
  template: `
    @let warning = warning$ | async;

    @if (warning) {
      <bit-banner
        id="reseller-warning-banner"
        icon="bwi-billing"
        bannerType="info"
        [showClose]="false"
      >
        {{ warning.message }}
      </bit-banner>
    }
  `,
  imports: [BannerModule, SharedModule],
})
export class OrganizationResellerRenewalWarningComponent implements OnInit {
  @Input({ required: true }) organization!: Organization;

  warning$!: Observable<OrganizationResellerRenewalWarning | null>;

  constructor(private organizationWarningsService: OrganizationWarningsService) {}

  ngOnInit() {
    this.warning$ = this.organizationWarningsService.getResellerRenewalWarning$(this.organization);
  }
}
