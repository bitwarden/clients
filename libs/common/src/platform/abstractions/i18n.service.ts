import { Observable } from "rxjs";

import { TranslationService } from "./translation.service";

export abstract class I18nService extends TranslationService {
  abstract userSetLocale$: Observable<string | undefined>;
  abstract locale$: Observable<string>;
  abstract setLocale(locale: string): Promise<void>;
  abstract init(): Promise<void>;
}
