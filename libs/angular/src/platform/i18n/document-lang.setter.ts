import { Subscription } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

/**
 * A service for managing the setting of the `lang="<locale>" attribute on the
 * main document for the application.
 */
export class DocumentLangSetter {
  constructor(
    private readonly document: Document,
    private readonly i18nService: I18nService,
  ) {}

  /**
   * Starts listening to an upstream source for the best locale for the user
   * and applies it to the application document.
   * @returns A subscription that can be unsubscribed if you wish to stop
   * applying lang attribute updates to the application document.
   */
  start(): Subscription {
    return this.i18nService.locale$.subscribe((locale) => {
      this.document.documentElement.lang = locale;
    });
  }
}
