import { LOCALE_ID, Pipe, PipeTransform, inject } from "@angular/core";

import { formatRequestedWindow } from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

/**
 * The "Requested window" column's secondary line, for every table that renders one. Accepts the
 * bounds as ISO strings or epoch milliseconds, since the rows carry them both ways.
 */
@Pipe({ name: "requestedWindow" })
export class RequestedWindowPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);
  private readonly i18nService = inject(I18nService);

  transform(start: string | number, end: string | number, nowMs: number): string {
    return formatRequestedWindow(
      (key, ...args) => this.i18nService.t(key, ...args),
      this.locale,
      epochMs(start),
      epochMs(end),
      nowMs,
    );
  }
}

function epochMs(value: string | number): number {
  return typeof value === "number" ? value : Date.parse(value);
}
