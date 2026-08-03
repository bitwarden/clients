import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ImportResult } from "../models";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class DelineaCsvImporter extends BaseImporter implements Importer {
  result = new ImportResult();

  async parse(data: string): Promise<ImportResult> {
    const parseCsvResults = this.parseCsv(data, true) as Record<string, any>[];
    if (parseCsvResults == null) {
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    for (const line of parseCsvResults) {
      const cipher = this.initLoginCipher();

      cipher.name = this.getValueOrDefault(line["Secret Name"], "--");
      cipher.type = line["URL"] ? CipherType.Login : CipherType.SecureNote;

      for (const [key, value] of Object.entries(line)) {
        if (key === "Secret Name") {
          continue;
        } else if (key === "Password" && cipher.type === CipherType.Login) {
          cipher.login.password = value;
        } else if (key === "URL" && cipher.type === CipherType.Login) {
          cipher.login.uris = this.makeUriArray(value);
        } else if (key === "Username" && cipher.type === CipherType.Login) {
          cipher.login.username = value;
        } else if (key === "Folder") {
          const cipherIdx = this.result.ciphers.length;
          const folderName = this.convertFolderPathToName(value);
          const existingFolderIdx = this.result.folders.findIndex((f) => f.name === folderName);
          if (existingFolderIdx === -1) {
            const folderIdx = this.result.folders.length;
            const folder = new FolderView();
            folder.name = folderName;
            this.result.folders.push(folder);
            this.result.folderRelationships.push([cipherIdx, folderIdx]);
          } else {
            this.result.folderRelationships.push([cipherIdx, existingFolderIdx]);
          }
        } else if (key === "Notes") {
          cipher.notes = value;
        } else {
          if (value !== null && value !== "") {
            const field = new FieldView();
            field.name = key;
            field.value = value;
            if (key === "Password") {
              field.type = FieldType.Hidden;
            }
            cipher.fields.push(field);
          }
        }
      }

      this.cleanupCipher(cipher);
      this.result.ciphers.push(cipher);
    }
    this.result.success = true;

    return this.result;
  }

  private convertFolderPathToName(folderPath: string) {
    let folderName = folderPath.replace(/\\/g, "/");
    if (folderName.startsWith("/")) {
      folderName = folderName.slice(1);
    }
    return folderName;
  }
}
