import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import {
  canAccessVaultTab,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ImportCollectionServiceAbstraction } from "@bitwarden/importer/core";
import { ImportComponent } from "@bitwarden/importer/ui";

import { LooseComponentsModule, SharedModule } from "../../../shared";
import { ImportCollectionAdminService } from "../../../tools/import/import-collection-admin.service";
import { CollectionAdminService } from "../../../vault/core/collection-admin.service";

@Component({
  templateUrl: "org-import.component.html",
  standalone: true,
  imports: [SharedModule, ImportComponent, LooseComponentsModule],
  providers: [
    {
      provide: ImportCollectionServiceAbstraction,
      useClass: ImportCollectionAdminService,
      deps: [CollectionAdminService],
    },
  ],
})
export class OrgImportComponent implements OnInit {
  protected routeOrgId: string = null;
  protected loading = false;
  protected disabled = false;

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.routeOrgId = this.route.snapshot.paramMap.get("organizationId");
  }

  /**
   * Callback that is called after a successful import.
   */
  protected async onSuccessfulImport(organizationId: string): Promise<void> {
    const organization = await firstValueFrom(this.organizationService.get$(organizationId));
    if (organization == null) {
      return;
    }

    if (canAccessVaultTab(organization)) {
      await this.router.navigate(["organizations", organizationId, "vault"]);
    }
  }
}
