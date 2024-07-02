import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { NoItemsModule, SearchModule } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared/shared.module";

@Component({
  selector: "app-sm-landing",
  standalone: true,
  imports: [SharedModule, SearchModule, NoItemsModule, HeaderModule],
  templateUrl: "sm-landing.component.html",
})
export class SMLandingComponent {
  constructor(
    private router: Router,
    private organizationService: OrganizationService,
  ) {}

  tryItNowUrl: string;

  async ngOnInit() {
    const enabledOrgs = (await this.organizationService.getAll()).filter((e) => e.enabled);

    if (enabledOrgs?.length > 0) {
      const orgsUserIsAdminOf: Organization[] = enabledOrgs.filter((o) => o.isAdmin);
      //User is a part of at least one org and user is an admin of at least one
      if (orgsUserIsAdminOf.length > 0) {
        const organizationId = orgsUserIsAdminOf[0].id;

        this.tryItNowUrl = `/organizations/${organizationId}/billing/subscription`;
      } else {
        //User is not an admin but there are orgs
        this.tryItNowUrl = "/request-sm-access";
      }
    } else {
      //User needs to create an org to sign up for secrets manager
      this.tryItNowUrl = "/create-organization";
    }
  }
}
