import { LOCALE_ID, Pipe, PipeTransform, inject } from "@angular/core";

import { formatDuration } from "./format-duration";

/** Compact, localized duration label, e.g. `15m`, `4h`, `1d`. */
@Pipe({
  name: "durationShort",
})
export class DurationShortPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(seconds: number): string {
    return formatDuration(this.locale, seconds, "narrow");
  }
}
