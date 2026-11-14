import { Provider } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { I18nMockService } from "@bitwarden/components";

import messages from "../../../_locales/en/messages.json";

type LocaleMessage = { message: string; placeholders?: Record<string, { content: string }> };

/** Rewrites `$NAME$` placeholders into the `__$1__` form that `I18nMockService` substitutes. */
function toLookupTable(source: Record<string, LocaleMessage>) {
  return Object.fromEntries(
    Object.entries(source).map(([key, { message, placeholders = {} }]) => [
      key,
      Object.entries(placeholders).reduce(
        (text, [name, { content }]) =>
          text.replace(new RegExp(`\\$${name}\\$`, "gi"), `__${content}__`),
        message,
      ),
    ]),
  );
}

/** Providers the autofill UI stories need, backed by the extension's real English strings. */
export const autofillStoryProviders: Provider[] = [
  {
    provide: I18nService,
    useFactory: () => new I18nMockService(toLookupTable(messages as Record<string, LocaleMessage>)),
  },
  {
    provide: PlatformUtilsService,
    useValue: { copyToClipboard: () => {} } satisfies Partial<PlatformUtilsService>,
  },
];
