import { Injectable, inject } from "@angular/core";

import { DialogService } from "@bitwarden/components";

import { ClientOptions, KeeperRegion, Vault } from "../../importers/keeper/access";
import { KeeperDirectImporter } from "../../importers/keeper/keeper-direct-importer";
import { ImportResult } from "../../models";

import { KeeperPasswordPromptComponent } from "./dialog/keeper-password-prompt.component";
import { KeeperDirectImportUIService } from "./keeper-direct-import-ui.service";

@Injectable({
  providedIn: "root",
})
export class KeeperDirectImportService {
  private readonly keeperDirectImportUIService = inject(KeeperDirectImportUIService);
  private readonly dialogService = inject(DialogService);

  private inFlight: Promise<ImportResult> | undefined;

  async handleImport(email: string, region: KeeperRegion): Promise<ImportResult> {
    if (this.inFlight !== undefined) {
      return this.inFlight;
    }

    const password = await KeeperPasswordPromptComponent.open(this.dialogService);

    if (!password) {
      throw new Error("Authentication cancelled");
    }

    const options: ClientOptions = {
      ui: this.keeperDirectImportUIService,
      region,
    };

    this.inFlight = (async () => {
      try {
        const vault = await Vault.open(email, password, options);
        return new KeeperDirectImporter().convertVaultToImportResult(vault);
      } finally {
        this.inFlight = undefined;
        this.keeperDirectImportUIService.reset();
      }
    })();

    return this.inFlight;
  }
}
