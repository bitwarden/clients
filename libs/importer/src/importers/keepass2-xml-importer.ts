// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FieldType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class KeePass2XmlImporter extends BaseImporter implements Importer {
  result = new ImportResult();

  parse(data: string): Promise<ImportResult> {
    const doc = this.parseXml(data);
    if (doc == null) {
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    //Note: The doc.querySelector("KeePassFile > Root > Group") no longers works on node and we have to breakdown the query by nodes
    const KeePassFileNode = doc.querySelector("KeePassFile");

    if (KeePassFileNode == null) {
      this.result.errorMessage = "Missing `KeePassFile` node.";
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    const RootNode = KeePassFileNode.querySelector("Root");
    if (RootNode == null) {
      this.result.errorMessage = "Missing `KeePassFile > Root` node.";
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    const rootGroup = RootNode.querySelector("Group");
    if (rootGroup == null) {
      this.result.errorMessage = "Missing `KeePassFile > Root > Group` node.";
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    this.traverse(rootGroup, true, "");

    if (this.organization) {
      this.moveFoldersToCollections(this.result);
    }

    this.result.success = true;
    return Promise.resolve(this.result);
  }

  traverse(node: Element, isRootNode: boolean, groupPrefixName: string) {
    const folderIndex = this.result.folders.length;
    let groupName = groupPrefixName;

    if (!isRootNode) {
      if (groupName !== "") {
        groupName += "/";
      }
      const nameEl = this.querySelectorDirectChild(node, "Name");
      groupName += nameEl == null ? "-" : nameEl.textContent;
      const folder = new FolderView();
      folder.name = groupName;
      this.result.folders.push(folder);
    }

    this.querySelectorAllDirectChild(node, "Entry").forEach((entry) => {
      const cipherIndex = this.result.ciphers.length;

      const cipher = this.initLoginCipher();
      this.querySelectorAllDirectChild(entry, "String").forEach((entryString) => {
        const valueEl = this.querySelectorDirectChild(entryString, "Value");
        const value = valueEl != null ? valueEl.textContent : null;
        if (this.isNullOrWhitespace(value)) {
          return;
        }
        const keyEl = this.querySelectorDirectChild(entryString, "Key");
        const key = keyEl != null ? keyEl.textContent : null;

        if (key === "URL") {
          cipher.login.uris = this.makeUriArray(value);
        } else if (key === "UserName") {
          cipher.login.username = value;
        } else if (key === "Password") {
          cipher.login.password = value;
        } else if (key === "otp") {
          cipher.login.totp = value.replace("key=", "");
        } else if (key === "Title") {
          cipher.name = value;
        } else if (key === "Notes") {
          cipher.notes += value + "\n";
        } else {
          let type = FieldType.Text;
          const attrs = valueEl.attributes as any;
          if (
            attrs.length > 0 &&
            attrs.ProtectInMemory != null &&
            attrs.ProtectInMemory.value === "True"
          ) {
            type = FieldType.Hidden;
          }
          this.processKvp(cipher, key, value, type);
        }
      });

      this.cleanupCipher(cipher);
      this.result.ciphers.push(cipher);

      if (!isRootNode) {
        this.result.folderRelationships.push([cipherIndex, folderIndex]);
      }
    });

    this.querySelectorAllDirectChild(node, "Group").forEach((group) => {
      this.traverse(group, false, groupName);
    });
  }
}
