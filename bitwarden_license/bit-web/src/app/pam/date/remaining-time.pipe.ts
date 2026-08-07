import { Pipe, PipeTransform } from "@angular/core";

import { formatRemaining } from "..";

/**
 * Renders the time remaining until `notAfter` (an ISO date string), relative to `nowMs`, as a
 * short low-noise countdown — "2h 5m", "47m", "15s", or "0s" once the instant has passed (or for
 * an unparseable value). Pass a ticking `nowMs` (e.g. a per-second signal) so the label counts
 * down; the pipe is pure, so it only recomputes when `notAfter` or `nowMs` changes.
 */
@Pipe({
  name: "remainingTime",
})
export class RemainingTimePipe implements PipeTransform {
  transform(notAfter: string, nowMs: number): string {
    return formatRemaining(Date.parse(notAfter) - nowMs);
  }
}
