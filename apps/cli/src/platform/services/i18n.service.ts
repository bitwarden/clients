import * as fs from "fs";
import * as path from "path";

import { I18nService as BaseI18nService } from "@bitwarden/common/platform/services/i18n.service";
import { StateProvider } from "@bitwarden/state";

export class I18nService extends BaseI18nService {
  constructor(systemLanguage: string, localesDirectory: string, stateProvider: StateProvider) {
    super(
      systemLanguage,
      localesDirectory,
      (formattedLocale: string) => {
        const filePath = path.join(
          __dirname,
          this.localesDirectory + "/" + formattedLocale + "/messages.json",
        );
        const localesJson = fs.readFileSync(filePath, "utf8");
        const locales = JSON.parse(localesJson.replace(/^\uFEFF/, "")); // strip the BOM
        return Promise.resolve(locales);
      },
      stateProvider,
    );

    this.supportedTranslationLocales = ["en"];
  }
}
