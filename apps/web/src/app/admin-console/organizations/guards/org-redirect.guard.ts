import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from "@angular/router";

import {
  canAccessOrgAdmin,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";

@Injectable({
  providedIn: "root",
})
export class OrganizationRedirectGuard implements CanActivate {
  constructor(
    private router: Router,
    private organizationService: OrganizationService,
  ) {}

  async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const org = await this.organizationService.get(route.params.organizationId);

    const customRedirect = route.data?.autoRedirectCallback;
    if (customRedirect) {
      let redirectPath = customRedirect(org);
      if (typeof redirectPath === "string") {
        redirectPath = [redirectPath];
      }
      return this.router.createUrlTree([state.url, ...redirectPath]);
    }

    if (canAccessOrgAdmin(org)) {
      return this.router.createUrlTree(["/organizations", org.id]);
    }
    return this.router.createUrlTree(["/"]);
  }
}
