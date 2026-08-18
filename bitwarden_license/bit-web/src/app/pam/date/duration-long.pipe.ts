import { Pipe } from "@angular/core";

import { DurationBasePipe } from "./duration-base.pipe";

/**
 * Spelled-out, localized lease-duration label, e.g. `15 minutes`, `1 hour`, `4 hours`,
 * `1 day`. Used by the access-rules table. See {@link DurationBasePipe} for the shared
 * unit selection and formatting.
 */
@Pipe({
  name: "durationLong",
})
export class DurationLongPipe extends DurationBasePipe {
  protected readonly unitDisplay = "long";
}
