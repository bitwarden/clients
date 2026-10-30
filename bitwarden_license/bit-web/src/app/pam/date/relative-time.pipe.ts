import { LOCALE_ID, Pipe, PipeTransform, inject } from "@angular/core";

import { formatRelativeTime } from "..";

/** A localized relative phrase, e.g. "5 min. ago" or "in 2 hr.". */
@Pipe({
  name: "relativeTime",
})
export class RelativeTimePipe implements PipeTransform {
  private readonly formatter = new Intl.RelativeTimeFormat(inject(LOCALE_ID), {
    numeric: "always",
    style: "narrow",
  });

  transform(value: string | null | undefined): string {
    if (!value) {
      return "";
    }
    const epochMs = Date.parse(value);
    if (Number.isNaN(epochMs)) {
      return "";
    }
    return formatRelativeTime(epochMs, Date.now(), this.formatter);
  }
}
