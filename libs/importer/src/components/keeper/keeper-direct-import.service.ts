import { Injectable, inject } from "@angular/core";

import { ClientOptions, KeeperRegion, Vault } from "../../importers/keeper/access";
import { KeeperDirectImporter } from "../../importers/keeper/keeper-direct-importer";
import { ImportResult } from "../../models";

import { KeeperDirectImportUIService } from "./keeper-direct-import-ui.service";

@Injectable({
  providedIn: "root",
})
export class KeeperDirectImportService {
  private readonly keeperDirectImportUIService = inject(KeeperDirectImportUIService);

  private inFlight: Promise<ImportResult> | undefined;

  async handleImport(email: string, region: KeeperRegion): Promise<ImportResult> {
    if (this.inFlight !== undefined) {
      return this.inFlight;
    }

    this.keeperDirectImportUIService.setEmail(email);

    const options: ClientOptions = {
      ui: this.keeperDirectImportUIService,
      region,
    };

    this.inFlight = (async () => {
      try {
        const vault = await Vault.open(email, options);
        return new KeeperDirectImporter().convertVaultToImportResult(vault);
      } finally {
        this.inFlight = undefined;
        this.keeperDirectImportUIService.reset();
      }
    })();

    return this.inFlight;
  }
}
