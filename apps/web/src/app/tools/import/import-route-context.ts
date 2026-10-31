import { inject, Injectable } from "@angular/core";
import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import {
  canAccessVaultTab,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { isId, OrganizationId } from "@bitwarden/common/types/guid";
import {
  IMPORT_ORGANIZATION_ID_ROUTE_PARAM,
  IMPORT_RETURN_TO_PARAM,
  ImportScope,
  importScopeFromQuery,
  navigateCarryingImportParams,
} from "@bitwarden/importer-ui";
import { vaultCommandsAfterImport } from "@bitwarden/vault";

/** Where the import screens live and where they end up: the personal import, or an organization's
 *  from its admin console, which the route says by carrying an `organizationId`. */
@Injectable({ providedIn: "root" })
export class ImportRouteContext {
  private readonly router = inject(Router);
  private readonly organizationService = inject(OrganizationService);
  private readonly accountService = inject(AccountService);

  /** The organization the import belongs to, or undefined for the personal import. */
  organizationId(route: ActivatedRoute): OrganizationId | undefined {
    const param = route.snapshot.paramMap.get(IMPORT_ORGANIZATION_ID_ROUTE_PARAM);
    if (param == null) {
      return undefined;
    }
    if (!isId<OrganizationId>(param)) {
      throw new Error(
        `Invalid OrganizationId provided in route parameter \`${IMPORT_ORGANIZATION_ID_ROUTE_PARAM}\``,
      );
    }
    return param;
  }

  /** Where an organization import was started from, carried in the URL across its screens. */
  returnTo(route: ActivatedRoute): string | undefined {
    return route.snapshot.queryParamMap.get(IMPORT_RETURN_TO_PARAM) ?? undefined;
  }

  /** The vault the import was started from, carried in the URL across its screens. */
  scope(route: ActivatedRoute): ImportScope {
    return importScopeFromQuery(route);
  }

  /** Moves between the import's screens, keeping `returnTo` and the vault scope in the URL. */
  navigate(
    route: ActivatedRoute,
    commands: string[],
    extras: NavigationExtras = {},
  ): Promise<boolean> {
    return navigateCarryingImportParams(this.router, route, commands, extras);
  }

  /** The first import screen, to which the others add their own segments. */
  basePath(organizationId: OrganizationId | undefined): string[] {
    return organizationId == null
      ? ["/tools/import"]
      : ["/organizations", organizationId, "settings", "tools", "import"];
  }

  /** After an import: for a personal import, the page it was started from (All items if none); for
   *  an organization's, its vault when the user can open it. A user who can't stays where they are,
   *  as the legacy import does. */
  async viewImportedItems(
    organizationId: OrganizationId | undefined,
    route: ActivatedRoute,
  ): Promise<void> {
    if (organizationId == null) {
      await this.router.navigate(vaultCommandsAfterImport(route));
      return;
    }

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const organization = await firstValueFrom(
      this.organizationService
        .organizations$(userId)
        .pipe(map((organizations) => organizations.find((o) => o.id === organizationId))),
    );
    if (organization != null && canAccessVaultTab(organization)) {
      await this.router.navigate(["organizations", organizationId, "vault"]);
    }
  }
}
