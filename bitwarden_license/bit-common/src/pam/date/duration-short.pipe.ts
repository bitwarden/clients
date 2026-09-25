import { LOCALE_ID, Pipe, PipeTransform, inject } from "@angular/core";

import { formatDuration } from "./format-duration";

/**
 * Compact, localized lease-duration label, e.g. `15m`, `1h`, `4h`, `1d`. Used by the
 * access-requests views (history and my-requests tabs). See {@link formatDuration} for
 * the shared unit selection and formatting.
 */
@Pipe({
  name: "durationShort",
})
export class DurationShortPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(seconds: number): string {
    return formatDuration(this.locale, seconds, "narrow");
  }
}
