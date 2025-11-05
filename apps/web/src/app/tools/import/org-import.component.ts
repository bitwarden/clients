import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import {
  canAccessVaultTab,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { isId, OrganizationId } from "@bitwarden/common/types/guid";
import {
  DefaultImportMetadataService,
  ImportCollectionServiceAbstraction,
  ImportMetadataServiceAbstraction,
} from "@bitwarden/importer-core";
import {
  ImportComponent,
  ImporterProviders,
  SYSTEM_SERVICE_PROVIDER,
} from "@bitwarden/importer-ui";
import { safeProvider } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

import { ImportCollectionAdminService } from "./import-collection-admin.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "org-import.component.html",
  imports: [SharedModule, ImportComponent, HeaderModule],
  providers: [
    ...ImporterProviders,
    safeProvider({
      provide: ImportMetadataServiceAbstraction,
      useClass: DefaultImportMetadataService,
      deps: [SYSTEM_SERVICE_PROVIDER],
    }),
    {
      provide: ImportCollectionServiceAbstraction,
      useClass: ImportCollectionAdminService,
      deps: [CollectionAdminService],
    },
  ],
})
export class OrgImportComponent implements OnInit {
  protected routeOrgId: OrganizationId | undefined = undefined;
  protected loading = false;
  protected disabled = false;

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private router: Router,
    private accountService: AccountService,
  ) {}

  ngOnInit(): void {
    const orgIdParam = this.route.snapshot.paramMap.get("organizationId");
    if (orgIdParam === undefined) {
      throw new Error("`organizationId` is a required route parameter");
    }

    if (!isId<OrganizationId>(orgIdParam)) {
      throw new Error("Invalid OrganizationId provided in route parameter `organizationId`");
    }

    this.routeOrgId = orgIdParam;
  }

  /**
   * Callback that is called after a successful import.
   */
  protected async onSuccessfulImport(organizationId: string): Promise<void> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const organization = await firstValueFrom(
      this.organizationService
        .organizations$(userId)
        .pipe(map((organizations) => organizations.find((o) => o.id === organizationId))),
    );
    if (organization == null) {
      return;
    }

    if (canAccessVaultTab(organization)) {
      await this.router.navigate(["organizations", organizationId, "vault"]);
    }
  }
}
