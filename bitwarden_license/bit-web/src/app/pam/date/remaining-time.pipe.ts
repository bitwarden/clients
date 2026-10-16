import { Pipe, PipeTransform } from "@angular/core";

import { formatRemaining } from "..";

/** Pure, so pass a ticking `nowMs` for the countdown to move. */
@Pipe({
  name: "remainingTime",
})
export class RemainingTimePipe implements PipeTransform {
  transform(notAfter: string, nowMs: number): string {
    return formatRemaining(Date.parse(notAfter) - nowMs);
  }
}
