import { Injectable, inject } from "@angular/core";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { ClientOptions, KeeperRegion, Vault } from "../../importers/keeper/access";
import {
  KeeperDirectImporter,
  KeeperDirectImportResult,
} from "../../importers/keeper/keeper-direct-importer";

import { KeeperDirectImportUIService } from "./keeper-direct-import-ui.service";

@Injectable({
  providedIn: "root",
})
export class KeeperDirectImportService {
  private readonly keeperDirectImportUIService = inject(KeeperDirectImportUIService);

  private inFlight: Promise<KeeperDirectImportResult> | undefined;

  async handleImport(
    email: string,
    region: KeeperRegion,
    organizationId: OrganizationId | undefined,
  ): Promise<KeeperDirectImportResult> {
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
        const importer = new KeeperDirectImporter();
        if (organizationId !== undefined) {
          importer.organizationId = organizationId;
        }
        return importer.convertVaultToImportResult(vault);
      } finally {
        this.inFlight = undefined;
        this.keeperDirectImportUIService.reset();
      }
    })();

    return this.inFlight;
  }
}
