import { Injectable } from "@angular/core";

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
  constructor(
    private keeperDirectImportUIService: KeeperDirectImportUIService,
    private dialogService: DialogService,
  ) {}

  async handleImport(
    email: string,
    region: KeeperRegion,
    includeSharedFolders: boolean,
  ): Promise<ImportResult> {
    const password = await KeeperPasswordPromptComponent.open(this.dialogService);

    if (!password) {
      throw new Error("Authentication cancelled");
    }

    const options: ClientOptions = {
      ui: this.keeperDirectImportUIService,
      region,
    };

    const vault = await Vault.open(email, password, options);

    return new KeeperDirectImporter().convertVaultToImportResult(vault, includeSharedFolders);
  }
}
