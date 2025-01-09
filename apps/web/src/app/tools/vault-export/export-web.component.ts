import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { ExportComponent } from "@bitwarden/vault-export-ui";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

@Component({
  templateUrl: "export-web.component.html",
  standalone: true,
  imports: [SharedModule, ExportComponent, HeaderModule],
})
export class ExportWebComponent {
  protected loading = false;
  protected disabled = false;

  constructor(private router: Router) {}

  /**
   * Callback that is called after a successful export.
   */
  protected async onSuccessfulExport(organizationId: string): Promise<void> {}
}
