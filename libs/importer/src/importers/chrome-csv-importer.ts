import { ImportResult } from "../models/import-result";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

export class ChromeCsvImporter extends BaseImporter implements Importer {
  private androidPatternRegex = new RegExp("^android:\\/\\/.*(?<=@)(.*)(?=\\/)");

  private normalizeAndroidUrl(url: string): string {
    const match = url?.match(this.androidPatternRegex);
    return match ? `androidapp://${match[1]}` : url;
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
      if (!name && this.androidPatternRegex.test(value.url)) {
        name = value.url.match(this.androidPatternRegex)[1];
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
