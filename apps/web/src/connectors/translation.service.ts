// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { TranslationService as BaseTranslationService } from "@bitwarden/common/platform/services/translation.service";

import { SupportedTranslationLocales } from "../translation-constants";

export class TranslationService extends BaseTranslationService {
  private _translationLocale: string;

  constructor(systemLanguage: string, localesDirectory: string) {
    super(systemLanguage || "en-US", localesDirectory, async (formattedLocale: string) => {
      const filePath =
        this.localesDirectory +
        "/" +
        formattedLocale +
        "/messages.json?cache=" +
        process.env.CACHE_TAG;
      const localesResult = await fetch(filePath);
      const locales = await localesResult.json();
      return locales;
    });

    this.supportedTranslationLocales = SupportedTranslationLocales;
  }

  get translationLocale(): string {
    return this._translationLocale;
  }

  set translationLocale(locale: string) {
    this._translationLocale = locale;
  }
}
