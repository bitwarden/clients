import { Observable } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

export class I18nMockService implements I18nService {
  locale$: Observable<string>;
  supportedTranslationLocales: string[];
  translationLocale: string;
  collator: Intl.Collator;
  localeNames: Map<string, string>;

  constructor(private lookupTable: Record<string, string | ((...args: string[]) => string)>) {}

  t(id: string, p1?: string, p2?: string, p3?: string) {
    let value = this.lookupTable[id];
    if (typeof value == "string") {
      if (value !== "") {
        if (p1 != null) {
          value = value.split("__$1__").join(p1.toString());
        }
        if (p2 != null) {
          value = value.split("__$2__").join(p2.toString());
        }
        if (p3 != null) {
          value = value.split("__$3__").join(p3.toString());
        }
      }

      return value;
    }
    return value(p1, p2, p3);
  }

  translate(id: string, p1?: string, p2?: string, p3?: string) {
    return this.t(id, p1, p2, p3);
  }
}
