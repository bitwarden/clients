import { inject, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import { CompactModeService } from "@bitwarden/components";

/** How many text lines a Health list row shows. */
export type HealthListRowLines = 2 | 3;

/**
 * Pixel heights for `bit-table-v2 [virtualRowHeight]` in Health lists. Every row of a list is
 * exactly this tall, so the virtual scroll never measures. Two-line rows use the popup vault's
 * constants; a third line adds one line of helper text.
 */
export const HEALTH_LIST_ROW_HEIGHT: Readonly<
  Record<HealthListRowLines, Readonly<{ default: number; compact: number }>>
> = Object.freeze({
  2: Object.freeze({ default: 60, compact: 53 }),
  3: Object.freeze({ default: 76, compact: 69 }),
});

/** The row height for `lines`, following compact mode. Call in an injection context. */
export function injectHealthListRowHeight(lines: HealthListRowLines): Signal<number> {
  const heights = HEALTH_LIST_ROW_HEIGHT[lines];
  return toSignal(
    inject(CompactModeService).enabled$.pipe(
      map((compact) => (compact ? heights.compact : heights.default)),
    ),
    { initialValue: heights.default },
  );
}
