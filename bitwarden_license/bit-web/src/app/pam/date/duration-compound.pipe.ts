import { LOCALE_ID, Pipe, PipeTransform, inject } from "@angular/core";

import { formatCompoundDuration } from "./format-duration";

@Pipe({ name: "durationCompound" })
export class DurationCompoundPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(seconds: number): string {
    return formatCompoundDuration(this.locale, seconds, "long");
  }
}
