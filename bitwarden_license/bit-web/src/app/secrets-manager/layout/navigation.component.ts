import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { concatMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { SecretsManagerLogo } from "@bitwarden/web-vault/app/layouts/secrets-manager-logo";

@Component({
  selector: "sm-navigation",
  templateUrl: "./navigation.component.html",
})
export class NavigationComponent {
  protected readonly logo = SecretsManagerLogo;
  protected orgFilter = (org: Organization) => org.canAccessSecretsManager;
  protected isAdmin$ = this.route.params.pipe(
    concatMap(
      async (params) => (await this.organizationService.get(params.organizationId))?.isAdmin,
    ),
  );

  constructor(
    protected route: ActivatedRoute,
    private organizationService: OrganizationService,
  ) {}
}
