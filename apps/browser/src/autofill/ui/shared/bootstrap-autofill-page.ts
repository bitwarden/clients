import { ComponentRef, Provider, provideZonelessChangeDetection, Type } from "@angular/core";
import { createApplication } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { AutofillPageI18nService } from "./autofill-page-i18n.service";

/**
 * Starts a standalone Angular app for one autofill iframe page and mounts `component` into the
 * page body.
 */
export async function bootstrapAutofillPage<T>(
  component: Type<T>,
  i18nService: AutofillPageI18nService,
  providers: Provider[] = [],
): Promise<ComponentRef<T>> {
  const app = await createApplication({
    providers: [
      provideZonelessChangeDetection(),
      { provide: I18nService, useValue: i18nService },
      { provide: AutofillPageI18nService, useValue: i18nService },
      // `bit-color-password` copies through this when the user copies a generated password.
      {
        provide: PlatformUtilsService,
        useValue: {
          copyToClipboard: (text: string) => void globalThis.navigator.clipboard?.writeText(text),
        } satisfies Partial<PlatformUtilsService>,
      },
      ...providers,
    ],
  });

  const host = globalThis.document.createElement("div");
  globalThis.document.body.append(host);
  return app.bootstrap(component, host);
}

/**
 * Applies the extension theme to the page. "system" follows the OS preference, as the content
 * script pages always have.
 */
export function applyAutofillPageTheme(theme?: string) {
  const resolved =
    theme === ThemeTypes.Dark ||
    (theme === ThemeTypes.System && globalThis.matchMedia("(prefers-color-scheme: dark)").matches)
      ? ThemeTypes.Dark
      : ThemeTypes.Light;

  const { classList } = globalThis.document.documentElement;
  classList.remove(`theme_${ThemeTypes.Light}`, `theme_${ThemeTypes.Dark}`);
  classList.add(`theme_${resolved}`);
}
