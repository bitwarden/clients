// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

// The PasswordDepot17XmlImporter class is responsible for importing password data from Password Depot 17 XML files
// It extends the BaseImporter class and implements the Importer interface
// It provides methods to parse the XML data, extract relevant information, and create cipher objects
export class PasswordDepot17XmlImporter extends BaseImporter implements Importer {
  result = new ImportResult();

  // Parse the XML data from the Password Depot export file and extracts the relevant information
  parse(data: string): Promise<ImportResult> {
    const doc: XMLDocument = this.parseXml(data);
    if (doc == null) {
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    // Check if the root node is present
    const rootNode = doc.querySelector("passwordfile");
    if (rootNode == null) {
      this.result.errorMessage = "Missing `passwordfile` node.";
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    // Check if the version is supported
    const headerNode = this.querySelectorDirectChild(rootNode, "header");
    if (headerNode == null) {
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    const versionNode = this.querySelectorDirectChild(headerNode, "version");
    if (versionNode == null) {
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    const version = versionNode.textContent;
    if (version !== "17.0.0") {
      this.result.errorMessage = "Unsupported export version detected - (only 17.0 is supported)";
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    // Abort import if the file is encrypted
    const encryptedNode = this.querySelectorDirectChild(headerNode, "encrypted");
    if (encryptedNode != null && encryptedNode.textContent == "True") {
      this.result.errorMessage = "Encrypted Password Depot files are not supported.";
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    // Check if the passwords node is present
    // This node contains all the password entries
    const passwordsNode = rootNode.querySelector("passwords");
    if (passwordsNode == null) {
      this.result.errorMessage = "Missing `passwordfile > passwords` node.";
      this.result.success = false;
      return Promise.resolve(this.result);
    }

    this.traverse(passwordsNode, true, "");

    if (this.organization) {
      this.moveFoldersToCollections(this.result);
    }

    this.result.success = true;
    return Promise.resolve(this.result);
  }

  // Traverses the XML tree and processes each node
  // It starts from the root node and goes through each group and item
  // This method is recursive and handles nested groups
  private traverse(node: Element, isRootNode: boolean, groupPrefixName: string) {
    const folderIndex = this.result.folders.length;
    let groupName = groupPrefixName;

    if (!isRootNode) {
      if (groupName !== "") {
        groupName += "/";
      }
      const nameEl = node.attributes.getNamedItem("name");
      groupName += nameEl == null ? "-" : nameEl.textContent;
      const folder = new FolderView();
      folder.name = groupName;
      this.result.folders.push(folder);
    }

    this.querySelectorAllDirectChild(node, "item").forEach((entry) => {
      const cipherIndex = this.result.ciphers.length;

      const cipher = this.initLoginCipher();

      const entryFields = entry.children;
      for (let i = 0; i < entryFields.length; i++) {
        const entryField = entryFields[i];

        if (entryField.tagName === "description") {
          cipher.name = entryField.textContent;
          continue;
        }

        if (entryField.tagName === "comment") {
          cipher.notes = entryField.textContent;
          continue;
        }

        if (entryField.tagName === "type") {
          const type = entryField.textContent;
          switch (type) {
            case "0":
              cipher.type = CipherType.Login;
              cipher.login = new LoginView();
              break;
            case "1":
              cipher.type = CipherType.Card;
              cipher.card = new CardView();
              break;
          }
          continue;
        }

        if (cipher.type === CipherType.Login) {
          if (entryField.tagName === "username") {
            cipher.login.username = entryField.textContent;
            continue;
          }

          if (entryField.tagName === "password") {
            cipher.login.password = decodeURI(entryField.textContent);
            continue;
          }

          if (entryField.tagName === "url") {
            cipher.login.uris = this.makeUriArray(entryField.textContent);
            continue;
          }
        }

        if (entryField.tagName === "customfields") {
          this.parseCustomFields(entryField, cipher);
          continue;
        }

        this.processKvp(cipher, entryField.tagName, entryField.textContent, FieldType.Text);
      }

      this.cleanupCipher(cipher);
      this.result.ciphers.push(cipher);

      if (!isRootNode) {
        this.result.folderRelationships.push([cipherIndex, folderIndex]);
      }
    });

    this.querySelectorAllDirectChild(node, "group").forEach((group) => {
      this.traverse(group, false, groupName);
    });
  }

  // Parses custom fields and adds them to the cipher
  // It iterates through all the custom fields and adds them to the cipher
  private parseCustomFields(entryField: Element, cipher: CipherView) {
    this.querySelectorAllDirectChild(entryField, "field").forEach((customField) => {
      const customFieldObject = this.parseCustomField(customField);
      if (customFieldObject == null) {
        return;
      }
      this.processKvp(
        cipher,
        customFieldObject.name,
        customFieldObject.value,
        customFieldObject.type,
      );
    });
  }

  // Parses a custom field and adds it to the cipher
  private parseCustomField(customField: Element): FieldView | null {
    const keyEl = this.querySelectorDirectChild(customField, "name");
    const key = keyEl != null ? keyEl.textContent : null;

    if (key == null) {
      return null;
    }

    const valueEl = this.querySelectorDirectChild(customField, "value");
    const value = valueEl != null ? valueEl.textContent : null;

    const visibleEl = this.querySelectorDirectChild(customField, "visible");
    const visible = visibleEl != null ? visibleEl.textContent : null;

    if (visible == "0") {
      return { name: key, value: value, type: FieldType.Hidden, linkedId: null } as FieldView;
    }

    // const kindEl = this.querySelectorDirectChild(customField, "kind");
    // const kind = kindEl != null ? kindEl.textContent : null;

    // const typeEl = this.querySelectorDirectChild(customField, "type");
    // const type = typeEl != null ? typeEl.textContent : null;

    return { name: key, value: value, type: FieldType.Text, linkedId: null } as FieldView;
  }
}
