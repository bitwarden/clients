import { I18nService as BaseI18nService } from "@bitwarden/common/platform/services/i18n.service";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";

export class I18nRendererService extends BaseI18nService {
  constructor(
    systemLanguage: string,
    localesDirectory: string,
    globalStateProvider: GlobalStateProvider,
  ) {
    super(
      systemLanguage,
      localesDirectory,
      (formattedLocale: string) => {
        return ipc.platform.getLanguageFile(formattedLocale);
      },
      globalStateProvider,
    );

    // Please leave 'en' where it is, as it's our fallback language in case no translation can be found
    this.supportedTranslationLocales = [
      "en",
      "af",
      "ar",
      "az",
      "be",
      "bg",
      "bn",
      "bs",
      "ca",
      "cs",
      "da",
      "de",
      "el",
      "en-GB",
      "en-IN",
      "eo",
      "es",
      "et",
      "eu",
      "fa",
      "fi",
      "fil",
      "fr",
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
      "lv",
      "me",
      "ml",
      "nb",
      "nl",
      "nn",
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
      "th",
      "tr",
      "uk",
      "vi",
      "zh-CN",
      "zh-TW",
    ];
  }
}
