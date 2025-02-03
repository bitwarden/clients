import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { map, concatMap, firstValueFrom } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { Icon, Icons } from "@bitwarden/components";

@Component({
  templateUrl: "./org-suspended.component.html",
})
export class OrgSuspendedComponent {
  constructor(
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private route: ActivatedRoute,
  ) {}

  protected NoAccess: Icon = Icons.NoAccess;
  protected organizationName$ = this.route.params.pipe(
    concatMap(async (params) => {
      const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
      return await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(params.organizationId)),
      );
    }),
    map((org) => org?.name),
  );
}
