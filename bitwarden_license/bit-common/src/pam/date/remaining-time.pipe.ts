import { inject, LOCALE_ID, Pipe, PipeTransform } from "@angular/core";

import { formatRemaining } from "./format-remaining";

/** Pure, so pass a ticking `nowMs` for the countdown to move. */
@Pipe({
  name: "remainingTime",
})
export class RemainingTimePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(notAfter: string, nowMs: number): string {
    return formatRemaining(this.locale, Date.parse(notAfter) - nowMs);
  }
}
