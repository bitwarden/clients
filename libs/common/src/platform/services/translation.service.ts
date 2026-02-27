// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { TranslationService as TranslationServiceAbstraction } from "../abstractions/translation.service";

export abstract class TranslationService implements TranslationServiceAbstraction {
  // First locale is the default (English)
  supportedTranslationLocales: string[] = ["en"];
  defaultLocale = "en";
  abstract translationLocale: string;
  collator: Intl.Collator;
  localeNames = new Map<string, string>([
    ["af", "Afrikaans"],
    ["ar", "العربية الفصحى"],
    ["az", "Azərbaycanca"],
    ["be", "Беларуская"],
    ["bg", "български"],
    ["bn", "বাংলা"],
    ["bs", "bosanski jezik"],
    ["ca", "català"],
    ["cs", "čeština"],
    ["cy", "Cymraeg, y Gymraeg"],
    ["da", "dansk"],
    ["de", "Deutsch"],
    ["el", "Ελληνικά"],
    ["en", "English"],
    ["en-GB", "English (British)"],
    ["en-IN", "English (India)"],
    ["eo", "Esperanto"],
    ["es", "español"],
    ["et", "eesti"],
    ["eu", "euskara"],
    ["fa", "فارسی"],
    ["fi", "suomi"],
    ["fil", "Wikang Filipino"],
    ["fr", "français"],
    ["gl", "galego"],
    ["he", "עברית"],
    ["hi", "हिन्दी"],
    ["hr", "hrvatski"],
    ["hu", "magyar"],
    ["id", "Bahasa Indonesia"],
    ["it", "italiano"],
    ["ja", "日本語"],
    ["ka", "ქართული"],
    ["km", "ខ្មែរ, ខេមរភាសា, ភាសាខ្មែរ"],
    ["kn", "ಕನ್ನಡ"],
    ["ko", "한국어"],
    ["lt", "lietuvių kalba"],
    ["lv", "Latvietis"],
    ["me", "црногорски"],
    ["ml", "മലയാളം"],
    ["mr", "मराठी"],
    ["my", "ဗမာစကား"],
    ["nb", "norsk (bokmål)"],
    ["ne", "नेपाली"],
    ["nl", "Nederlands"],
    ["nn", "Norsk Nynorsk"],
    ["or", "ଓଡ଼ିଆ"],
    ["pl", "polski"],
    ["pt-BR", "português do Brasil"],
    ["pt-PT", "português"],
    ["ro", "română"],
    ["ru", "русский"],
    ["si", "සිංහල"],
    ["sk", "slovenčina"],
    ["sl", "Slovenski jezik, Slovenščina"],
    ["sr", "Српски"],
    ["sv", "svenska"],
    ["ta", "தமிழ்"],
    ["te", "తెలుగు"],
    ["th", "ไทย"],
    ["tr", "Türkçe"],
    ["uk", "українська"],
    ["vi", "Tiếng Việt"],
    ["zh-CN", "中文（中国大陆）"],
    ["zh-TW", "中文（台灣）"],
  ]);

  protected inited: boolean;
  protected defaultMessages: any = {};
  protected localeMessages: any = {};

  constructor(
    protected systemLanguage: string,
    protected localesDirectory: string,
    protected getLocalesJson: (formattedLocale: string) => Promise<any>,
  ) {
    this.systemLanguage = systemLanguage.replace("_", "-");
  }

  async init(locale?: string) {
    if (this.inited) {
      throw new Error("i18n already initialized.");
    }
    if (this.supportedTranslationLocales == null || this.supportedTranslationLocales.length === 0) {
      throw new Error("supportedTranslationLocales not set.");
    }

    this.inited = true;
    this.translationLocale = locale != null ? locale : this.systemLanguage;

    try {
      this.collator = new Intl.Collator(this.translationLocale, {
        numeric: true,
        sensitivity: "base",
      });
    } catch {
      this.collator = null;
    }

    if (this.supportedTranslationLocales.indexOf(this.translationLocale) === -1) {
      this.translationLocale = this.translationLocale.slice(0, 2);

      if (this.supportedTranslationLocales.indexOf(this.translationLocale) === -1) {
        this.translationLocale = this.defaultLocale;
      }
    }

    if (this.localesDirectory != null) {
      await this.loadMessages(this.translationLocale, this.localeMessages);
      if (this.translationLocale !== this.defaultLocale) {
        await this.loadMessages(this.defaultLocale, this.defaultMessages);
      }
    }
  }

  t(id: string, p1?: string, p2?: string, p3?: string): string {
    return this.translate(id, p1, p2, p3);
  }

  translate(id: string, p1?: string | number, p2?: string | number, p3?: string | number): string {
    let result: string;
    // eslint-disable-next-line
    if (this.localeMessages.hasOwnProperty(id) && this.localeMessages[id]) {
      result = this.localeMessages[id];
      // eslint-disable-next-line
    } else if (this.defaultMessages.hasOwnProperty(id) && this.defaultMessages[id]) {
      result = this.defaultMessages[id];
    } else {
      result = "";
    }

    if (result !== "") {
      if (p1 != null) {
        result = result.split("__$1__").join(p1.toString());
      }
      if (p2 != null) {
        result = result.split("__$2__").join(p2.toString());
      }
      if (p3 != null) {
        result = result.split("__$3__").join(p3.toString());
      }
    }

    return result;
  }

  protected async loadMessages(locale: string, messagesObj: any): Promise<any> {
    const formattedLocale = locale.replace("-", "_");
    const locales = await this.getLocalesJson(formattedLocale);
    for (const prop in locales) {
      // eslint-disable-next-line
      if (!locales.hasOwnProperty(prop)) {
        continue;
      }
      messagesObj[prop] = locales[prop].message;

      if (locales[prop].placeholders) {
        for (const placeProp in locales[prop].placeholders) {
          if (
            !locales[prop].placeholders.hasOwnProperty(placeProp) || // eslint-disable-line
            !locales[prop].placeholders[placeProp].content
          ) {
            continue;
          }

          const replaceToken = "\\$" + placeProp.toUpperCase() + "\\$";
          let replaceContent = locales[prop].placeholders[placeProp].content;
          if (replaceContent === "$1" || replaceContent === "$2" || replaceContent === "$3") {
            replaceContent = "__$" + replaceContent + "__";
          }
          messagesObj[prop] = messagesObj[prop].replace(
            new RegExp(replaceToken, "g"),
            replaceContent,
          );
        }
      }
    }
  }
}
