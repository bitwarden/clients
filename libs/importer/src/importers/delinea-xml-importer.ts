import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

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
        this.processFolder(this.result, folderPath, false);
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

      const folderPath = this.getValueOrDefault(
        this.querySelectorDirectChild(secretNode, "FolderPath")?.textContent ?? "",
      );
      if (folderPath) {
        this.processFolder(this.result, folderPath, true);
      }

      this.cleanupCipher(cipher);
      this.result.ciphers.push(cipher);
    }

    if (this.organization) {
      this.moveFoldersToCollections(this.result);
    }

    this.result.success = true;
    return Promise.resolve(this.result);
  }

  private getFolderNodes(importFileNode: Element): Element[] {
    const foldersNode = this.querySelectorDirectChild(importFileNode, "Folders");
    if (!foldersNode) {
      return [];
    }
    return this.querySelectorAllDirectChild(foldersNode, "Folder");
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
  // its value is taken from its <Value> tag. Empty, missing, or all-whitespace
  // Values are ignored
  private getSlugValues(secretNode: Element): { slug: string; value: string }[] {
    const slugValues: { slug: string; value: string }[] = [];

    const secretItemsNode = this.querySelectorDirectChild(secretNode, "SecretItems");
    if (!secretItemsNode) {
      return slugValues;
    }
    const items = this.querySelectorAllDirectChild(secretItemsNode, "SecretItem");
    for (const item of items) {
      const slug = this.getValueOrDefault(
        this.querySelectorDirectChild(item, "Slug")?.textContent ?? "",
      );
      const value = this.getValueOrDefault(
        this.querySelectorDirectChild(item, "Value")?.textContent ?? "",
      );
      if (slug && value) {
        slugValues.push({ slug, value });
      }
    }
    return slugValues;
  }
}
