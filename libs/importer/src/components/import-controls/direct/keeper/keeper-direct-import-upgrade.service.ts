import { Injectable } from "@angular/core";

import { ClientOptions, KeeperRegion, Ui, Vault } from "../../../../importers/keeper/access";
import {
  KeeperDirectImporter,
  KeeperDirectImportResult,
} from "../../../../importers/keeper/keeper-direct-importer";

/** `KeeperDirectImportService` for the upgraded import flow: the caller supplies the UI, so the
 *  login prompts render in the import card rather than in the legacy dialog. */
@Injectable({ providedIn: "root" })
export class KeeperDirectImportUpgradeService {
  async handleImport(
    email: string,
    region: KeeperRegion,
    ui: Ui,
  ): Promise<KeeperDirectImportResult> {
    const options: ClientOptions = { ui, region, accountDeviceApproval: true };
    const vault = await Vault.open(email, options);
    return new KeeperDirectImporter().convertVaultToImportResult(vault);
  }
}
