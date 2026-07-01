import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ImportResult } from "../models";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class DelineaXmlImporter extends BaseImporter implements Importer {
  result = new ImportResult();

  parse(data: string): Promise<ImportResult> {
    const doc = this.parseXml(data);
    if (doc == null) {
      this.result.errorMessage = "Unable to parse XML file.";
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    const importFileNode = doc.querySelector("ImportFile");
    if (importFileNode == null) {
      this.result.errorMessage = "Missing `ImportFile` node.";
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    const foldersNode = this.querySelectorDirectChild(importFileNode, "Folders");
    if (foldersNode) {
      for (const folderNode of this.querySelectorAllDirectChild(foldersNode, "Folder")) {
        const folderPath = this.querySelectorDirectChild(folderNode, "FolderPath")?.textContent;
        if (folderPath) {
          const folder = new FolderView();
          folder.name = this.convertFolderPathToName(folderPath);
          this.result.folders.push(folder);
        }
      }
    }

    const secretsNode = this.querySelectorDirectChild(importFileNode, "Secrets");
    if (secretsNode) {
      const secrets = this.querySelectorAllDirectChild(secretsNode, "Secret");
      for (const secret of secrets) {
        const cipher = this.initLoginCipher();

        cipher.type = CipherType.SecureNote;

        cipher.name = this.querySelectorDirectChild(secret, "SecretName")?.textContent ?? "--";

        const secretItemsNode = this.querySelectorDirectChild(secret, "SecretItems");
        if (secretItemsNode) {
          // Secret data is stored as a list of fields, each with an identifying slug and a value
          const secretItems: { slug: string; value: string }[] = [];
          this.querySelectorAllDirectChild(secretItemsNode, "SecretItem").forEach((si) => {
            const slug = this.querySelectorDirectChild(si, "Slug")?.textContent;
            const value = this.querySelectorDirectChild(si, "Value")?.textContent;
            if (slug && value) {
              secretItems.push({ slug, value });
            }
          });
          for (const item of secretItems) {
            const field = new FieldView();
            field.name = item.slug;
            field.value = item.value;
            if (item.slug === "password") {
              field.type = FieldType.Hidden;
            }
            cipher.fields.push(field);
          }
        }

        const folderPath = this.querySelectorDirectChild(secret, "FolderPath")?.textContent;
        if (folderPath) {
          const folderIdx = this.result.folders.findIndex(
            (f) => f.name === this.convertFolderPathToName(folderPath),
          );
          if (folderIdx !== -1) {
            const cipherIdx = this.result.ciphers.length;
            this.result.folderRelationships.push([cipherIdx, folderIdx]);
          }
        }

        this.cleanupCipher(cipher);
        this.result.ciphers.push(cipher);
      }
    }

    this.result.success = true;
    return Promise.resolve(this.result);
  }

  private convertFolderPathToName(folderPath: string) {
    let folderName = folderPath.replace("\\", "/");
    if (folderName.startsWith("/")) {
      folderName = folderName.slice(1);
    }
    return folderName;
  }
}
