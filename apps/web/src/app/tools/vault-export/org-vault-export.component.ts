import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { ExportComponent } from "@bitwarden/vault-export-ui";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

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
    this.routeOrgId = this.route.snapshot.paramMap.get("organizationId") as OrganizationId;
  }

  /**
   * Callback that is called after a successful export.
   */
  protected async onSuccessfulExport(organizationId: OrganizationId): Promise<void> {}
}
