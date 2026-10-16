import { LOCALE_ID, Pipe, PipeTransform, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { joinEndpoint, windowParts } from "./format-window";

@Pipe({ name: "windowRange" })
export class WindowRangePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);
  private readonly i18nService = inject(I18nService);

  transform(start: string, end: string, nowMs: number): string {
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return "";
    }
    const translate = (key: string, ...args: string[]) => this.i18nService.t(key, ...args);
    const parts = windowParts(this.locale, startMs, endMs, nowMs);
    const range = translate(
      "pamWindowRange",
      joinEndpoint(translate, parts.start),
      joinEndpoint(translate, parts.end),
    );
    return parts.sharedDay ? translate("pamWindowOnDay", parts.sharedDay, range) : range;
  }
}
