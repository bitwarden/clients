import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

@Component({
  selector: "app-org-tools",
  templateUrl: "tools.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class ToolsComponent implements OnInit {
  organization: Organization;
  accessReports = false;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private messagingService: MessagingService,
  ) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.params.subscribe(async (params) => {
      this.organization = await this.organizationService.get(params.organizationId);
      // TODO: Maybe we want to just make sure they are not on a free plan? Just compare useTotp for now
      // since all paid plans include useTotp
      this.accessReports = this.organization.useTotp;
      this.loading = false;
    });
  }

  upgradeOrganization() {
    this.messagingService.send("upgradeOrganization", { organizationId: this.organization.id });
  }
}
