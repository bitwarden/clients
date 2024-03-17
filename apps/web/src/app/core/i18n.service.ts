import { I18nService as BaseI18nService } from "@bitwarden/common/platform/services/i18n.service";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";

import { SupportedTranslationLocales } from "../../translation-constants";

export class I18nService extends BaseI18nService {
  constructor(
    systemLanguage: string,
    localesDirectory: string,
    globalStateProvider: GlobalStateProvider,
  ) {
    super(
      systemLanguage || "en-US",
      localesDirectory,
      async (formattedLocale: string) => {
        const filePath =
          this.localesDirectory +
          "/" +
          formattedLocale +
          "/messages.json?cache=" +
          process.env.CACHE_TAG;
        const localesResult = await fetch(filePath);
        const locales = await localesResult.json();
        return locales;
      },
      globalStateProvider,
    );

    this.supportedTranslationLocales = SupportedTranslationLocales;
  }
}
