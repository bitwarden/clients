import { APP_INITIALIZER, NgModule } from "@angular/core";
import { Observable, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TranslationService } from "@bitwarden/common/platform/services/translation.service";

import eng from "../../../locales/en/messages.json";

class PreloadedEnglishI18nService extends TranslationService implements I18nService {
  translationLocale = "en";
  userSetLocale$: Observable<string | undefined> = of("en");
  locale$: Observable<string> = of("en");
  constructor() {
    super("en", "", () => {
      return Promise.resolve(eng);
    });
  }

  setLocale(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

function i18nInitializer(i18nService: I18nService): () => Promise<void> {
  return async () => {
    await (i18nService as any).init();
  };
}

// This is a helper I18nService implementation that loads the english `message.json` eliminating
//  the need for fetching them dynamically. It should only be used within storybook.
@NgModule({
  providers: [
    {
      provide: I18nService,
      useClass: PreloadedEnglishI18nService,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: i18nInitializer,
      deps: [I18nService],
      multi: true,
    },
  ],
})
export class PreloadedEnglishI18nModule {}
