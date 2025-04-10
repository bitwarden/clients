// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class StickyPasswordXmlImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const doc = this.parseXml(data);
    if (doc == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    const loginNodes = doc.querySelectorAll("root > Database > Logins > Login");
    Array.from(loginNodes).forEach((loginNode) => {
      const accountId = loginNode.getAttribute("ID");
      if (this.isNullOrWhitespace(accountId)) {
        return;
      }

      const usernameText = loginNode.getAttribute("Name");
      const passwordText = loginNode.getAttribute("Password");
      let titleText: string = null;
      let linkText: string = null;
      let notesText: string = null;
      let groupId: string = null;
      let groupText: string = null;

      const accountLogin = doc.querySelector(
        "root > Database > Accounts > Account > " +
          'LoginLinks > Login[SourceLoginID="' +
          accountId +
          '"]',
      );
      if (accountLogin != null) {
        const account = accountLogin.parentElement.parentElement;
        if (account != null) {
          titleText = account.getAttribute("Name");
          linkText = account.getAttribute("Link");
          groupId = account.getAttribute("ParentID");
          notesText = account.getAttribute("Comments");
          if (!this.isNullOrWhitespace(notesText)) {
            notesText = notesText.split("/n").join("\n");
          }
        }
      }

      if (!this.isNullOrWhitespace(groupId)) {
        groupText = this.buildGroupText(doc, groupId, "");
        this.processFolder(result, groupText);
      }

      const cipher = this.initLoginCipher();
      cipher.name = this.getValueOrDefault(titleText, "--");
      cipher.notes = this.getValueOrDefault(notesText);
      cipher.login.username = this.getValueOrDefault(usernameText);
      cipher.login.password = this.getValueOrDefault(passwordText);
      cipher.login.uris = this.makeUriArray(linkText);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }

  buildGroupText(doc: Document, groupId: string, groupText: string): string {
    const group = doc.querySelector('root > Database > Groups > Group[ID="' + groupId + '"]');
    if (group == null) {
      return groupText;
    }
    if (!this.isNullOrWhitespace(groupText)) {
      groupText = "/" + groupText;
    }
    groupText = group.getAttribute("Name") + groupText;
    return this.buildGroupText(doc, group.getAttribute("ParentID"), groupText);
  }
}
