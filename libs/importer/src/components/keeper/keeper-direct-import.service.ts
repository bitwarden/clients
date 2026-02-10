import { Injectable } from "@angular/core";

import { DialogService } from "@bitwarden/components";

import { ClientOptions, Vault } from "../../importers/keeper/access";
import { convertVaultToImportResult } from "../../importers/keeper/keeper-direct-importer";
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

  /**
   * Import a Keeper account by email
   * @param email The Keeper account email
   * @param server The Keeper data center server hostname
   * @param includeSharedFolders Whether to include shared folders in the import
   * @returns The ImportResult containing imported vault data
   */
  async handleImport(
    email: string,
    server: string,
    includeSharedFolders: boolean,
  ): Promise<ImportResult> {
    const password = await KeeperPasswordPromptComponent.open(this.dialogService);

    if (!password) {
      throw new Error("Authentication cancelled");
    }

    const options: ClientOptions = {
      ui: this.keeperDirectImportUIService,
      server,
    };

    const vault = await Vault.open(email, password, options);

    return convertVaultToImportResult(vault, includeSharedFolders);
  }
}
