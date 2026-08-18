import { Pipe } from "@angular/core";

import { DurationBasePipe } from "./duration-base.pipe";

/**
 * Compact, localized lease-duration label, e.g. `15m`, `1h`, `4h`, `1d`. Used by the
 * access-requests views (history and my-requests tabs). See {@link DurationBasePipe} for
 * the shared unit selection and formatting.
 */
@Pipe({
  name: "durationShort",
})
export class DurationShortPipe extends DurationBasePipe {
  protected readonly unitDisplay = "narrow";
}
