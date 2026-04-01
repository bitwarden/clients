// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, firstValueFrom, map } from "rxjs";

import { StateProvider, UserKeyDefinition, TRANSLATION_DISK } from "@bitwarden/state";

import { I18nService as I18nServiceAbstraction } from "../abstractions/i18n.service";

import { TranslationService } from "./translation.service";

export const LOCALE_USER = new UserKeyDefinition<string>(TRANSLATION_DISK, "locale", {
  deserializer: (value) => value,
  clearOn: [],
});

export class I18nService extends TranslationService implements I18nServiceAbstraction {
  translationLocale: string;
  userSetLocale$: Observable<string | undefined>;
  locale$: Observable<string>;

  constructor(
    protected systemLanguage: string,
    protected localesDirectory: string,
    protected getLocalesJson: (formattedLocale: string) => Promise<any>,
    protected stateProvider: StateProvider,
  ) {
    super(systemLanguage, localesDirectory, getLocalesJson);
    this.userSetLocale$ = this.stateProvider.getUserStateOrDefault$(LOCALE_USER, {
      userId: undefined,
      defaultValue: undefined,
    });
    this.locale$ = this.userSetLocale$.pipe(map((locale) => locale ?? this.translationLocale));
  }

  async setLocale(locale: string | null): Promise<void> {
    await this.stateProvider.setUserState(LOCALE_USER, locale);
  }

  override async init() {
    const storedLocale = await firstValueFrom(
      this.stateProvider.getUserStateOrDefault$(LOCALE_USER, {
        userId: undefined,
        defaultValue: undefined,
      }),
    );
    await super.init(storedLocale);
  }
}
