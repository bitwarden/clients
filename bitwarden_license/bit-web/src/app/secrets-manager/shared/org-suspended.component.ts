import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { map, concatMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Icon, Icons } from "@bitwarden/components";

@Component({
  templateUrl: "./org-suspended.component.html",
})
export class OrgSuspendedComponent {
  constructor(
    private organizationService: OrganizationService,
    private route: ActivatedRoute,
  ) {}

  protected NoAccess: Icon = Icons.NoAccess;
  protected organizationName$ = this.route.params.pipe(
    concatMap((params) => this.organizationService.get$(params.organizationId)),
    map((org) => org?.name),
  );
}
