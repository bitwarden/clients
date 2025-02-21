// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { ExportComponent } from "@bitwarden/vault-export-ui";

import { LooseComponentsModule, SharedModule } from "../../shared";

@Component({
  templateUrl: "org-vault-export.component.html",
  standalone: true,
  imports: [SharedModule, ExportComponent, LooseComponentsModule],
})
export class OrganizationVaultExportComponent implements OnInit {
  protected routeOrgId: string = null;
  protected loading = false;
  protected disabled = false;

  constructor(private route: ActivatedRoute) {}

  async ngOnInit() {
    this.routeOrgId = this.route.snapshot.paramMap.get("organizationId");
  }

  /**
   * Callback that is called after a successful export.
   */
  protected async onSuccessfulExport(organizationId: string): Promise<void> {}
}
