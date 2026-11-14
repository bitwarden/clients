import { Observable, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

/** Resolves a message key, with up to three positional substitutions. */
export type AutofillPageTranslate = (key: string, substitutions: string[]) => string;

/**
 * A minimal `I18nService` for the autofill iframe pages. These pages have no access to the
 * extension's state, so translation is delegated to `translate`, which is backed by
 * `chrome.i18n` where available or by the translations the background sends to sandboxed pages.
 */
export class AutofillPageI18nService extends I18nService {
  readonly supportedTranslationLocales: string[] = [];
  readonly translationLocale = globalThis.navigator.language;
  readonly collator = new Intl.Collator(globalThis.navigator.language);
  readonly localeNames = new Map<string, string>();
  readonly userSetLocale$: Observable<string | undefined> = of(undefined);
  readonly locale$: Observable<string> = of(globalThis.navigator.language);

  constructor(private translateMessage: AutofillPageTranslate) {
    super();
  }

  /** Replaces the translation source, e.g. once a sandboxed page receives its translations. */
  setTranslate(translateMessage: AutofillPageTranslate) {
    this.translateMessage = translateMessage;
  }

  t(id: string, p1?: string | number, p2?: string | number, p3?: string | number): string {
    const substitutions = [p1, p2, p3]
      .filter((p) => p !== undefined && p !== null)
      .map((p) => String(p));
    return this.translateMessage(id, substitutions);
  }

  translate(id: string, p1?: string, p2?: string, p3?: string): string {
    return this.t(id, p1, p2, p3);
  }

  async setLocale(): Promise<void> {}

  async init(): Promise<void> {}
}

/** Translates with `chrome.i18n`, for pages that are not sandboxed. */
export const chromeI18nTranslate: AutofillPageTranslate = (key, substitutions) =>
  chrome.i18n.getMessage(key, substitutions);

/** Translates from a fixed map, for sandboxed pages that receive their strings by message. */
export function translationMapTranslate(
  translations: Record<string, string>,
): AutofillPageTranslate {
  return (key) => translations[key] ?? "";
}
