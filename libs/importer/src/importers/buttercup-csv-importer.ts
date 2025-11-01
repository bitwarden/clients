import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

const OfficialProps = ["!group_id", "!group_name", "title", "username", "password", "URL", "id"];

// Fields to be removed after processing (case-insensitive)
const FieldsToRemove = ["!group_id", "!type", "title", "id", "note", "url", "username", "password"];

export class ButtercupCsvImporter extends BaseImporter implements Importer {
  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    // Map to store folder markers (entries named "--") by their !group_id
    const folderMarkers = new Map<string, string>();

    // First pass: Process folders and collect folder markers
    results.forEach((value) => {
      const groupName = this.getValueOrDefault(value["!group_name"]);
      const groupId = this.getValueOrDefault(value["!group_id"]);
      const title = this.getValueOrDefault(value.title, "--");

      this.processFolder(result, groupName);

      // If this is a folder marker (name is "--"), store it for later use
      if (title === "--" && !this.isNullOrWhitespace(groupId)) {
        const folderId =
          result.folders.length > 0 ? result.folders[result.folders.length - 1].id : null;
        if (folderId != null) {
          folderMarkers.set(groupId, folderId);
        }
      }
    });

    // Second pass: Process all entries
    results.forEach((value) => {
      const groupName = this.getValueOrDefault(value["!group_name"]);
      const groupId = this.getValueOrDefault(value["!group_id"]);
      const title = this.getValueOrDefault(value.title, "--");

      const cipher = this.initLoginCipher();
      cipher.name = title;
      cipher.login.username = this.getValueOrDefault(value.username);
      cipher.login.password = this.getValueOrDefault(value.password);
      cipher.login.uris = this.makeUriArray(value.URL);

      // Process custom fields with case-insensitive matching
      for (const prop in value) {
        // eslint-disable-next-line
        if (value.hasOwnProperty(prop)) {
          const propLower = prop.toLowerCase();
          const fieldValue = value[prop];

          // Handle 'url' custom field (case-insensitive)
          if (propLower === "url" && prop !== "URL" && !this.isNullOrWhitespace(fieldValue)) {
            const uris = this.makeUriArray(fieldValue);
            if (uris != null && uris.length > 0) {
              cipher.login.uris = cipher.login.uris || [];
              cipher.login.uris.push(...uris);
            }
            continue;
          }

          // Handle 'note' custom field (case-insensitive)
          if (propLower === "note" && !this.isNullOrWhitespace(fieldValue)) {
            cipher.notes = fieldValue;
            continue;
          }

          // Skip official props and fields that should be removed
          if (
            OfficialProps.indexOf(prop) !== -1 ||
            FieldsToRemove.some((f) => f.toLowerCase() === propLower)
          ) {
            continue;
          }

          // Add remaining custom fields
          this.processKvp(cipher, prop, fieldValue);
        }
      }

      // Associate entries to the right subfolder using !group_id
      if (!this.isNullOrWhitespace(groupId) && folderMarkers.has(groupId)) {
        cipher.folderId = folderMarkers.get(groupId);
      } else if (!this.isNullOrWhitespace(groupName)) {
        // Fallback to group name if no folder marker found
        const folder = result.folders.find((f) => f.name === groupName);
        if (folder != null) {
          cipher.folderId = folder.id;
        }
      }

      this.cleanupCipher(cipher);

      // Skip folder markers (entries named "--") in the final output
      if (
        title !== "--" ||
        !this.isNullOrWhitespace(cipher.login.password) ||
        !this.isNullOrWhitespace(cipher.login.username)
      ) {
        result.ciphers.push(cipher);
      }
    });

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return Promise.resolve(result);
  }
}
