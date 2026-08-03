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

    const folderNodes = this.getFolderNodes(importFileNode);
    for (const folderNode of folderNodes) {
      const folderPath = this.querySelectorDirectChild(folderNode, "FolderPath")?.textContent;
      if (folderPath) {
        const folder = new FolderView();
        folder.name = this.convertFolderPathToName(folderPath);
        this.result.folders.push(folder);
      }
    }

    const secretNodes = this.getSecretNodes(importFileNode);
    for (const secretNode of secretNodes) {
      const cipher = this.initLoginCipher();

      cipher.name = this.querySelectorDirectChild(secretNode, "SecretName")?.textContent ?? "--";

      const slugValues = this.getSlugValues(secretNode);
      // Currently the only specialized item type we support is login,
      // which is distinguished by the presence of a "url" slug
      cipher.type = slugValues.some((s) => s.slug === "url")
        ? CipherType.Login
        : CipherType.SecureNote;

      // Only the password, url, and username fields require
      // special handling, and only if the cipher is a login.
      // Everything else is parsed as a custom field.
      for (const item of slugValues) {
        if (item.slug === "password" && cipher.type === CipherType.Login) {
          cipher.login.password = item.value;
        } else if (item.slug === "url" && cipher.type === CipherType.Login) {
          cipher.login.uris = this.makeUriArray(item.value);
        } else if (item.slug === "username" && cipher.type === CipherType.Login) {
          cipher.login.username = item.value;
        } else if (item.slug === "notes") {
          cipher.notes = item.value;
        } else {
          const field = new FieldView();
          field.name = item.slug;
          field.value = item.value;
          if (item.slug === "password") {
            field.type = FieldType.Hidden;
          }
          cipher.fields.push(field);
        }
      }

      const folderPath = this.querySelectorDirectChild(secretNode, "FolderPath")?.textContent;
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

    this.result.success = true;
    return Promise.resolve(this.result);
  }

  private convertFolderPathToName(folderPath: string) {
    let folderName = folderPath.replace(/\\/g, "/");
    if (folderName.startsWith("/")) {
      folderName = folderName.slice(1);
    }
    return folderName;
  }

  private getFolderNodes(importFileNode: Element): Element[] {
    const secretsNode = this.querySelectorDirectChild(importFileNode, "Folders");
    if (!secretsNode) {
      return [];
    }
    return this.querySelectorAllDirectChild(secretsNode, "Folder");
  }

  private getSecretNodes(importFileNode: Element): Element[] {
    const secretsNode = this.querySelectorDirectChild(importFileNode, "Secrets");
    if (!secretsNode) {
      return [];
    }
    return this.querySelectorAllDirectChild(secretsNode, "Secret");
  }

  // Each <Secret> tag can contain a <SecretItems> tag that contains zero or more
  // <SecretItem> tags. Each <SecretItem> tag is identified by its <Slug> tag and
  // its value is taken from its <Value> tag, or "--" if the <Value> tag is absent
  private getSlugValues(secretNode: Element): { slug: string; value: string }[] {
    const slugValues: { slug: string; value: string }[] = [];

    const secretItemsNode = this.querySelectorDirectChild(secretNode, "SecretItems");
    if (!secretItemsNode) {
      return slugValues;
    }
    const items = this.querySelectorAllDirectChild(secretItemsNode, "SecretItem");
    for (const item of items) {
      const slug = this.querySelectorDirectChild(item, "Slug")?.textContent;
      const value = this.querySelectorDirectChild(item, "Value")?.textContent || "--";
      if (slug && value) {
        slugValues.push({ slug, value });
      }
    }
    return slugValues;
  }
}
