// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherType, FieldType, SecureNoteType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { ImportResult } from "../../models/import-result";
import { BaseImporter } from "../base-importer";
import { Importer } from "../importer";

import { PasswordDepotItemType, PasswordDepotCustomFieldType } from "./types";

/**
 * Importer for Password Depot 17 xml files.
 * @see https://www.password-depot.de/
 * It provides methods to parse the XML data, extract relevant information, and create cipher objects
 */
export class PasswordDepot17XmlImporter extends BaseImporter implements Importer {
  result = new ImportResult();

  _favouritesLookupTable = new Set<string>();

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

    let versionNode = this.querySelectorDirectChild(headerNode, "version");
    if (versionNode == null) {
      // Adding a fallback for MacOS Password Depot 17.0 export files
      // These files do not have a version node, but a dataformat node instead
      versionNode = this.querySelectorDirectChild(headerNode, "dataformat");
      if (versionNode == null) {
        this.result.success = false;
        return Promise.resolve(this.result);
      }
    }

    const version = versionNode.textContent;
    if (!version.startsWith("17")) {
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

    this.buildFavouritesLookupTable(rootNode);

    this.querySelectorAllDirectChild(passwordsNode, "group").forEach((group) => {
      this.traverse(group, "");
    });

    if (this.organization) {
      this.moveFoldersToCollections(this.result);
    }

    this.result.success = true;
    return Promise.resolve(this.result);
  }

  // Traverses the XML tree and processes each node
  // It starts from the root node and goes through each group and item
  // This method is recursive and handles nested groups
  private traverse(node: Element, groupPrefixName: string) {
    const folderIndex = this.result.folders.length;
    let groupName = groupPrefixName;

    if (groupName !== "") {
      groupName += "/";
    }

    // Check if the group has a fingerprint attribute (GUID of a folder)
    const groupFingerprint = node.attributes.getNamedItem("fingerprint");
    if (groupFingerprint?.textContent != "" && groupFingerprint.textContent != "null") {
      const nameEl = node.attributes.getNamedItem("name");
      groupName += nameEl == null ? "-" : nameEl.textContent;
      const folder = new FolderView();
      folder.name = groupName;
      this.result.folders.push(folder);
    }

    this.querySelectorAllDirectChild(node, "item").forEach((entry) => {
      const cipherIndex = this.result.ciphers.length;

      const cipher = this.initLoginCipher();
      //Set default item type similar how we default to Login in other importers
      let sourceType: PasswordDepotItemType = PasswordDepotItemType.Password;

      const entryFields = entry.children;
      for (let i = 0; i < entryFields.length; i++) {
        const entryField = entryFields[i];

        // Skip processing historical entries
        if (entryField.tagName === "hitems") {
          continue;
        }

        if (entryField.tagName === "description") {
          cipher.name = entryField.textContent;
          continue;
        }

        if (entryField.tagName === "comment") {
          cipher.notes = entryField.textContent;
          continue;
        }

        if (entryField.tagName === "type") {
          sourceType = entryField.textContent as PasswordDepotItemType;
          switch (sourceType) {
            case PasswordDepotItemType.Password:
            case PasswordDepotItemType.RDP:
            case PasswordDepotItemType.Putty:
            case PasswordDepotItemType.TeamViewer:
            case PasswordDepotItemType.Banking:
            case PasswordDepotItemType.Certificate:
            case PasswordDepotItemType.EncryptedFile:
              cipher.type = CipherType.Login;
              cipher.login = new LoginView();
              break;
            case PasswordDepotItemType.CreditCard:
              cipher.type = CipherType.Card;
              cipher.card = new CardView();
              break;
            case PasswordDepotItemType.SoftwareLicense:
            case PasswordDepotItemType.Information:
            case PasswordDepotItemType.Document:
              cipher.type = CipherType.SecureNote;
              cipher.secureNote = new SecureNoteView();
              cipher.secureNote.type = SecureNoteType.Generic;
              break;
            case PasswordDepotItemType.Identity:
              cipher.type = CipherType.Identity;
              cipher.identity = new IdentityView();
              break;
          }
          continue;
        }

        if (
          sourceType === PasswordDepotItemType.Password ||
          sourceType === PasswordDepotItemType.RDP ||
          sourceType === PasswordDepotItemType.Putty ||
          sourceType === PasswordDepotItemType.TeamViewer ||
          sourceType === PasswordDepotItemType.Banking ||
          sourceType === PasswordDepotItemType.Certificate ||
          sourceType === PasswordDepotItemType.EncryptedFile
        ) {
          if (this.parseLoginFields(entryField, cipher)) {
            continue;
          }
        }

        // fingerprint is the GUID of the entry
        // Base on the previously parsed favourites, we can identify an entry and set the favorite flag accordingly
        if (entryField.tagName === "fingerprint") {
          if (this._favouritesLookupTable.has(entryField.textContent)) {
            cipher.favorite = true;
          }
        }

        if (entryField.tagName === "customfields") {
          this.parseCustomFields(entryField, sourceType, cipher);
          continue;
        }

        if (sourceType === PasswordDepotItemType.Banking && entryField.tagName === "tans") {
          this.querySelectorAllDirectChild(entryField, "tan").forEach((tanEntry) => {
            this.parseBankingTANs(tanEntry, cipher);
          });
          continue;
        }

        this.processKvp(cipher, entryField.tagName, entryField.textContent, FieldType.Text);
      }

      this.cleanupCipher(cipher);
      this.result.ciphers.push(cipher);

      if (groupName !== "") {
        this.result.folderRelationships.push([cipherIndex, folderIndex]);
      }
    });

    this.querySelectorAllDirectChild(node, "group").forEach((group) => {
      this.traverse(group, groupName);
    });
  }

  // Parses custom fields and adds them to the cipher
  // It iterates through all the custom fields and adds them to the cipher
  private parseCustomFields(
    entryField: Element,
    sourceType: PasswordDepotItemType,
    cipher: CipherView,
  ) {
    this.querySelectorAllDirectChild(entryField, "field").forEach((customField) => {
      const customFieldObject = this.parseCustomField(customField);
      if (customFieldObject == null) {
        return;
      }

      switch (sourceType) {
        case PasswordDepotItemType.CreditCard:
          if (this.parseCreditCardCustomFields(customFieldObject, cipher)) {
            return;
          }
          break;
        case PasswordDepotItemType.Identity:
          if (this.parseIdentityCustomFields(customFieldObject, cipher)) {
            return;
          }
          break;
        case PasswordDepotItemType.Information:
          if (this.parseInformationCustomFields(customFieldObject, cipher)) {
            return;
          }
          break;
        default:
          // For other types, we will process the custom field as a regular key-value pair
          break;
      }

      this.processKvp(
        cipher,
        customFieldObject.name,
        customFieldObject.value,
        customFieldObject.type,
      );
    });
  }

  // Parses login fields and adds them to the cipher
  private parseLoginFields(entryField: Element, cipher: CipherView): boolean {
    if (entryField.tagName === "username") {
      cipher.login.username = entryField.textContent;
      return true;
    }

    if (entryField.tagName === "password") {
      cipher.login.password = entryField.textContent;
      return true;
    }

    if (entryField.tagName === "url") {
      cipher.login.uris = this.makeUriArray(entryField.textContent);
      return true;
    }

    return false;
  }

  // Parses a custom field and adds it to the cipher
  private parseCustomField(customField: Element): FieldView | null {
    let key: string = undefined;
    let value: string = undefined;
    let sourceFieldType: PasswordDepotCustomFieldType = PasswordDepotCustomFieldType.Memo;
    let visible: string = undefined;
    // A custom field is represented by a <field> element
    // On exports from the Windows clients: It contains a <name>, <value>, and optionally a <type> and <visible> element
    // On exports from the MacOs clients the key-values are defined as xml attributes instead of child nodes
    if (customField.hasAttributes()) {
      key = customField.getAttribute("name");
      if (key == null) {
        return null;
      }

      value = customField.getAttribute("value");

      const typeAttr = customField.getAttribute("type");
      sourceFieldType =
        typeAttr != null
          ? (typeAttr as PasswordDepotCustomFieldType)
          : PasswordDepotCustomFieldType.Memo;

      visible = customField.getAttribute("visible");
    } else {
      const keyEl = this.querySelectorDirectChild(customField, "name");
      key = keyEl != null ? keyEl.textContent : null;

      if (key == null) {
        return null;
      }

      const valueEl = this.querySelectorDirectChild(customField, "value");
      value = valueEl != null ? valueEl.textContent : null;

      const typeEl = this.querySelectorDirectChild(customField, "type");
      sourceFieldType =
        typeEl != null
          ? (typeEl.textContent as PasswordDepotCustomFieldType)
          : PasswordDepotCustomFieldType.Memo;

      const visibleEl = this.querySelectorDirectChild(customField, "visible");
      visible = visibleEl != null ? visibleEl.textContent : null;
    }

    if (sourceFieldType === PasswordDepotCustomFieldType.Date) {
      if (!isNaN(value as unknown as number)) {
        // Convert excel date format to JavaScript date
        const numericValue = parseInt(value);
        const secondsInDay = 86400;
        const missingLeapYearDays = secondsInDay * 1000;
        value = new Date((numericValue - (25567 + 2)) * missingLeapYearDays).toLocaleDateString();
      }
    }

    if (sourceFieldType === PasswordDepotCustomFieldType.Password) {
      return { name: key, value: value, type: FieldType.Hidden, linkedId: null } as FieldView;
    }

    if (sourceFieldType === PasswordDepotCustomFieldType.Boolean) {
      return { name: key, value: value, type: FieldType.Boolean, linkedId: null } as FieldView;
    }

    if (visible == "0") {
      return { name: key, value: value, type: FieldType.Hidden, linkedId: null } as FieldView;
    }

    return { name: key, value: value, type: FieldType.Text, linkedId: null } as FieldView;
  }

  // Parses credit card fields and adds them to the cipher
  private parseCreditCardCustomFields(customField: FieldView, cipher: CipherView): boolean {
    if (customField.name === "IDS_CardHolder") {
      cipher.card.cardholderName = customField.value;
      return true;
    }

    if (customField.name === "IDS_CardNumber") {
      cipher.card.number = customField.value;
      cipher.card.brand = CardView.getCardBrandByPatterns(cipher.card.number);
      return true;
    }

    if (customField.name === "IDS_CardExpires") {
      this.setCardExpiration(cipher, customField.value);
      return true;
    }

    if (customField.name === "IDS_CardCode") {
      cipher.card.code = customField.value;
      return true;
    }

    return false;
  }

  // Parses identity fields and adds them to the cipher
  private parseIdentityCustomFields(customField: FieldView, cipher: CipherView): boolean {
    if (customField.name === "IDS_IdentityName") {
      this.processFullName(cipher, customField.value);
      return true;
    }

    if (customField.name === "IDS_IdentityEmail") {
      cipher.identity.email = customField.value;
      return true;
    }

    if (customField.name === "IDS_IdentityFirstName") {
      cipher.identity.firstName = customField.value;
      return true;
    }

    if (customField.name === "IDS_IdentityLastName") {
      cipher.identity.lastName = customField.value;
      return true;
    }

    if (customField.name === "IDS_IdentityCompany") {
      cipher.identity.company = customField.value;
      return true;
    }

    if (customField.name === "IDS_IdentityAddress1") {
      cipher.identity.address1 = customField.value;
      return true;
    }

    if (customField.name === "IDS_IdentityAddress2") {
      cipher.identity.address2 = customField.value;
      return true;
    }

    if (customField.name === "IDS_IdentityCity") {
      cipher.identity.city = customField.value;
      return true;
    }

    if (customField.name === "IDS_IdentityState") {
      cipher.identity.state = customField.value;
      return true;
    }

    if (customField.name === "IDS_IdentityZIP") {
      cipher.identity.postalCode = customField.value;
      return true;
    }

    if (customField.name === "IDS_IdentityCountry") {
      cipher.identity.country = customField.value;
      return true;
    }

    if (customField.name === "IDS_IdentityPhone") {
      cipher.identity.phone = customField.value;
      return true;
    }

    return false;
  }

  // Parses information custom fields and adds them to the cipher
  private parseInformationCustomFields(customField: FieldView, cipher: CipherView): boolean {
    if (customField.name === "IDS_InformationText") {
      cipher.notes = customField.value;
      return true;
    }

    return false;
  }

  // Parses TAN objects and adds them to the cipher
  // It iterates through all the TAN fields and adds them to the cipher
  private parseBankingTANs(TANsField: Element, cipher: CipherView) {
    let tanNumber = "0";
    const entryFields = TANsField.children;
    for (let i = 0; i < entryFields.length; i++) {
      const entryField = entryFields[i];

      if (entryField.tagName === "number") {
        tanNumber = entryField.textContent;
        continue;
      }

      this.processKvp(cipher, `tan_${tanNumber}_${entryField.tagName}`, entryField.textContent);
    }
  }

  // Parses the favourites-node from the XML file, which contains a base64 encoded string
  // The string contains the fingerprints/GUIDs of the favourited entries, separated by new lines
  private buildFavouritesLookupTable(rootNode: Element): void {
    const favouritesNode = this.querySelectorDirectChild(rootNode, "favorites");
    if (favouritesNode == null) {
      return;
    }

    const decodedBase64String = atob(favouritesNode.textContent);
    if (decodedBase64String.indexOf("\r\n") > 0) {
      decodedBase64String.split("\r\n").forEach((line) => {
        this._favouritesLookupTable.add(line);
      });
      return;
    }

    decodedBase64String.split("\n").forEach((line) => {
      this._favouritesLookupTable.add(line);
    });
  }
}
