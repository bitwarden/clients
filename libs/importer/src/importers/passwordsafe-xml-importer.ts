// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

/** This is the importer for the xml format from pwsafe.org  */
export class PasswordSafeXmlImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const doc = this.parseXml(data);
    if (doc == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    const passwordSafe = doc.querySelector("passwordsafe");
    if (passwordSafe == null) {
      result.errorMessage = "Missing `passwordsafe` node.";
      result.success = false;
      return Promise.resolve(result);
    }

    const notesDelimiter = passwordSafe.getAttribute("delimiter");
    const entries = doc.querySelectorAll("passwordsafe > entry");
    Array.from(entries).forEach((entry) => {
      const group = this.querySelectorDirectChild(entry, "group");
      const groupText =
        group != null && !this.isNullOrWhitespace(group.textContent)
          ? group.textContent.split(".").join("/")
          : null;
      this.processFolder(result, groupText);

      const title = this.querySelectorDirectChild(entry, "title");
      const username = this.querySelectorDirectChild(entry, "username");
      const email = this.querySelectorDirectChild(entry, "email");
      const password = this.querySelectorDirectChild(entry, "password");
      const url = this.querySelectorDirectChild(entry, "url");
      const notes = this.querySelectorDirectChild(entry, "notes");
      const cipher = this.initLoginCipher();
      cipher.name = title != null ? this.getValueOrDefault(title.textContent, "--") : "--";
      cipher.notes =
        notes != null
          ? this.getValueOrDefault(notes.textContent, "").split(notesDelimiter).join("\n")
          : null;
      cipher.login.username =
        username != null ? this.getValueOrDefault(username.textContent) : null;
      cipher.login.password =
        password != null ? this.getValueOrDefault(password.textContent) : null;
      cipher.login.uris = url != null ? this.makeUriArray(url.textContent) : null;

      if (this.isNullOrWhitespace(cipher.login.username) && email != null) {
        cipher.login.username = this.getValueOrDefault(email.textContent);
      } else if (email != null && !this.isNullOrWhitespace(email.textContent)) {
        cipher.notes = this.isNullOrWhitespace(cipher.notes)
          ? "Email: " + email.textContent
          : cipher.notes + "\n" + "Email: " + email.textContent;
      }

      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }
}
