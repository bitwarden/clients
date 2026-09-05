import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class ChromeCsvImporter extends BaseImporter implements Importer {
  // Extracts the package name from an android:// URI of the form
  // android://[base64]@[package.name]/  using plain string ops (no regex)
  // to avoid polynomial backtracking on adversarial input.
  private extractAndroidPackageName(url: string): string | null {
    if (!url?.startsWith("android://")) {
      return null;
    }
    const atIdx = url.indexOf("@");
    if (atIdx === -1) {
      return null;
    }
    const slashIdx = url.indexOf("/", atIdx + 1);
    return slashIdx === -1 ? url.slice(atIdx + 1) : url.slice(atIdx + 1, slashIdx);
  }

  private normalizeAndroidUrl(url: string): string {
    const packageName = this.extractAndroidPackageName(url);
    return packageName != null ? `androidapp://${packageName}` : url;
  }

  parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const results = this.parseCsv(data, true);
    if (results == null) {
      result.success = false;
      return Promise.resolve(result);
    }

    results.forEach((value) => {
      const cipher = this.initLoginCipher();
      const normalizedUri = this.normalizeAndroidUrl(value.url);

      let name = value.name;
      if (!name) {
        const packageName = this.extractAndroidPackageName(value.url);
        if (packageName != null) {
          name = packageName;
        }
      }
      cipher.name = this.getValueOrDefault(name, "--");
      cipher.login.username = this.getValueOrDefault(value.username);
      cipher.login.password = this.getValueOrDefault(value.password);
      cipher.login.uris = this.makeUriArray(normalizedUri);
      cipher.notes = this.getValueOrDefault(value.note);
      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);
    });

    result.success = true;
    return Promise.resolve(result);
  }
}
