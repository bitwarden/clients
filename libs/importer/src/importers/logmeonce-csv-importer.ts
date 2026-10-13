import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class LogMeOnceCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      if (!value.name) {
        return;
      }

      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(value.name, "--");
      cipher.login.username = this.getValueOrDefault(value.username);
      cipher.login.password = this.getValueOrDefault(value.password);
      cipher.login.uris = this.makeUriArray(value.url);

      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);

      // Map groups to folders
      if (value.group) {
        let folderIdx = result.folders.findIndex((f) => f.name === value.group);
        if (folderIdx === -1) {
          const folder = new FolderView();
          folder.name = value.group;
          result.folders.push(folder);
          folderIdx = result.folders.length - 1;
        }
        result.folderRelationships.push([result.ciphers.length - 1, folderIdx]);
      }
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
