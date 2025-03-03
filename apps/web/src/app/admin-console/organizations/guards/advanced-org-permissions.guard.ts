import { Injectable } from "@angular/core";
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree,
} from "@angular/router";
import { firstValueFrom } from "rxjs";
import { switchMap } from "rxjs/operators";

import {
  canAccessOrgAdmin,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationUpsellingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";

export type AdvancedOrganizationPermissionsGuardData = {
  titleId: string;
  permissionsCallback: (
    org: Organization,
    services: {
      upsellingService: OrganizationUpsellingServiceAbstraction;
    },
  ) => Promise<boolean>;
};

@Injectable({
  providedIn: "root",
})
export class AdvancedOrganizationPermissionsGuard implements CanActivate {
  constructor(
    private router: Router,
    private organizationService: OrganizationService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private syncService: SyncService,
    private accountService: AccountService,
    private upsellingService: OrganizationUpsellingServiceAbstraction,
  ) {}

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Promise<boolean | UrlTree> {
    // TODO: We need to fix issue once and for all.
    if ((await this.syncService.getLastSync()) == null) {
      await this.syncService.fullSync(false);
    }

    const org = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.organizationService.organizations$(userId)),
        getById(route.params.organizationId),
      ),
    );

    if (org == null) {
      return this.router.createUrlTree(["/"]);
    }

    if (!org.isOwner && !org.enabled) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("organizationIsDisabled"),
      });
      return this.router.createUrlTree(["/"]);
    }

    const routeData = route.data as AdvancedOrganizationPermissionsGuardData;

    const hasPermissions =
      routeData.permissionsCallback === undefined ||
      routeData.permissionsCallback === null ||
      (await route.data.permissionsCallback(org, { upsellingService: this.upsellingService }));

    if (!hasPermissions) {
      // Handle linkable ciphers for organizations the user only has view access to
      // https://bitwarden.atlassian.net/browse/EC-203
      const cipherId =
        state.root.queryParamMap.get("itemId") || state.root.queryParamMap.get("cipherId");
      if (cipherId) {
        return this.router.createUrlTree(["/vault"], {
          queryParams: { itemId: cipherId },
        });
      }

      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("accessDenied"),
      });
      return canAccessOrgAdmin(org)
        ? this.router.createUrlTree(["/organizations", org.id])
        : this.router.createUrlTree(["/"]);
    }

    return true;
  }
}
