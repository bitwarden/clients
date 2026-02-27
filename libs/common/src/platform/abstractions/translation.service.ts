export abstract class TranslationService {
  abstract supportedTranslationLocales: string[];
  abstract translationLocale: string;
  abstract collator: Intl.Collator;
  abstract localeNames: Map<string, string>;
  abstract t(id: string, p1?: string | number, p2?: string | number, p3?: string | number): string;
  abstract translate(id: string, p1?: string, p2?: string, p3?: string): string;
}
