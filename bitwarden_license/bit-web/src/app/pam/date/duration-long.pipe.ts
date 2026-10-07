import { LOCALE_ID, Pipe, PipeTransform, inject } from "@angular/core";

import { formatDuration } from "./format-duration";

/** Spelled-out, localized duration label, e.g. `15 minutes`, `4 hours`, `1 day`. */
@Pipe({
  name: "durationLong",
})
export class DurationLongPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(seconds: number): string {
    return formatDuration(this.locale, seconds, "long");
  }
}
