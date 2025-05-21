import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { ImportComponent } from "@bitwarden/importer-ui";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

@Component({
  templateUrl: "import-web.component.html",
  standalone: true,
  imports: [SharedModule, ImportComponent, HeaderModule],
})
export class ImportWebComponent {
  protected loading = false;
  protected disabled = false;

  constructor(private router: Router) {}

  /**
   * Callback that is called after a successful import.
   */
  protected async onSuccessfulImport(organizationId: string): Promise<void> {
    await this.router.navigate(["vault"]);
  }
}
