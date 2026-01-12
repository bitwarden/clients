import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { isId, OrganizationId } from "@bitwarden/common/types/guid";
import { ExportComponent } from "@bitwarden/vault-export-ui";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "org-vault-export.component.html",
  imports: [SharedModule, ExportComponent, HeaderModule],
})
export class OrganizationVaultExportComponent implements OnInit {
  protected routeOrgId: OrganizationId | undefined = undefined;
  protected loading = false;
  protected disabled = false;

  constructor(private route: ActivatedRoute) {}

  async ngOnInit() {
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
   * Callback that is called after a successful export.
   */
  protected async onSuccessfulExport(organizationId: OrganizationId): Promise<void> {}
}
