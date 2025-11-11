// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, firstValueFrom, map } from "rxjs";

import { I18nService as I18nServiceAbstraction } from "../abstractions/i18n.service";
import { GlobalState, GlobalStateProvider, KeyDefinition, TRANSLATION_DISK } from "../state";

import { TranslationService } from "./translation.service";

const LOCALE_KEY = new KeyDefinition<string>(TRANSLATION_DISK, "locale", {
  deserializer: (value) => value,
});

export class I18nService extends TranslationService implements I18nServiceAbstraction {
  translationLocale: string;
  protected translationLocaleState: GlobalState<string>;
  userSetLocale$: Observable<string | undefined>;
  locale$: Observable<string>;

  constructor(
    protected systemLanguage: string,
    protected localesDirectory: string,
    protected getLocalesJson: (formattedLocale: string) => Promise<any>,
    globalStateProvider: GlobalStateProvider,
  ) {
    super(systemLanguage, localesDirectory, getLocalesJson);
    this.translationLocaleState = globalStateProvider.get(LOCALE_KEY);
    this.userSetLocale$ = this.translationLocaleState.state$;
    this.locale$ = this.userSetLocale$.pipe(map((locale) => locale ?? this.translationLocale));
  }

  async setLocale(locale: string | null): Promise<void> {
    await this.translationLocaleState.update(() => locale);
  }

  override async init() {
    const storedLocale = await firstValueFrom(this.translationLocaleState.state$);
    await super.init(storedLocale);
  }
}
