import { LOCALE_ID, Pipe, PipeTransform, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { joinEndpoint, windowEndpoint } from "./format-window";

@Pipe({ name: "windowInstant" })
export class WindowInstantPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);
  private readonly i18nService = inject(I18nService);

  transform(value: string, nowMs: number): string {
    const epochMs = Date.parse(value);
    if (Number.isNaN(epochMs)) {
      return "";
    }
    const translate = (key: string, ...args: string[]) => this.i18nService.t(key, ...args);
    return joinEndpoint(translate, windowEndpoint(this.locale, epochMs, nowMs));
  }
}
