// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { I18nService as BaseI18nService } from "@bitwarden/common/platform/services/i18n.service";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";

export default class I18nService extends BaseI18nService {
  constructor(systemLanguage: string, globalStateProvider: GlobalStateProvider) {
    super(
      systemLanguage,
      null,
      async (formattedLocale: string) => {
        // Deprecated
        const file = await fetch(this.localesDirectory + formattedLocale + "/messages.json");
        return await file.json();
      },
      globalStateProvider,
    );

    // Please leave 'en' where it is, as it's our fallback language in case no translation can be found
    this.supportedTranslationLocales = [
      "en",
      "ar",
      "az",
      "be",
      "bg",
      "bn",
      "bs",
      "ca",
      "cs",
      "cy",
      "da",
      "de",
      "el",
      "en-GB",
      "en-IN",
      "es",
      "et",
      "eu",
      "fa",
      "fi",
      "fil",
      "fr",
      "gl",
      "he",
      "hi",
      "hr",
      "hu",
      "id",
      "it",
      "ja",
      "ka",
      "km",
      "kn",
      "ko",
      "lt",
      "lv",
      "ml",
      "mr",
      "my",
      "nb",
      "ne",
      "nl",
      "nn",
      "or",
      "pl",
      "pt-BR",
      "pt-PT",
      "ro",
      "ru",
      "si",
      "sk",
      "sl",
      "sr",
      "sv",
      "te",
      "th",
      "tr",
      "uk",
      "vi",
      "zh-CN",
      "zh-TW",
    ];
  }

  t(id: string, p1?: string, p2?: string, p3?: string): string {
    return this.translate(id, p1, p2, p3);
  }

  translate(id: string, p1?: string, p2?: string, p3?: string): string {
    if (this.localesDirectory == null) {
      const placeholders: string[] = [];
      if (p1 != null) {
        placeholders.push(p1);
      }
      if (p2 != null) {
        placeholders.push(p2);
      }
      if (p3 != null) {
        placeholders.push(p3);
      }

      if (placeholders.length) {
        return chrome.i18n.getMessage(id, placeholders);
      } else {
        return chrome.i18n.getMessage(id);
      }
    }

    return super.translate(id, p1, p2, p3);
  }
}
