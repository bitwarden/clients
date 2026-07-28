/**
 * Preset durations offered by the access-rule dialog's default/max lease
 * pickers. Expressed in seconds (to match the rule's `*LeaseDurationSeconds`
 * controls) and offering a wide range, since an administrator configuring a
 * rule can grant longer windows than a self-service request.
 */
export const ACCESS_RULE_DURATION_PRESETS: ReadonlyArray<{ seconds: number; labelKey: string }> = [
  { seconds: 15 * 60, labelKey: "pamAccessRuleDuration15m" },
  { seconds: 30 * 60, labelKey: "pamAccessRuleDuration30m" },
  { seconds: 60 * 60, labelKey: "pamAccessRuleDuration1h" },
  { seconds: 4 * 60 * 60, labelKey: "pamAccessRuleDuration4h" },
  { seconds: 8 * 60 * 60, labelKey: "pamAccessRuleDuration8h" },
  { seconds: 24 * 60 * 60, labelKey: "pamAccessRuleDuration24h" },
  { seconds: 7 * 24 * 60 * 60, labelKey: "pamAccessRuleDuration7d" },
];

/** Default lease duration (1h) for a new access rule with no stored value. */
export const DEFAULT_ACCESS_RULE_DURATION_SECONDS = 60 * 60;

/**
 * Snap a duration to the nearest `seconds` entry in `options`, so a value
 * persisted outside a picker's option set still renders against an option.
 * Assumes a non-empty option list; callers own the "no stored value" fallback.
 */
export function snapToNearestDuration(
  seconds: number,
  options: ReadonlyArray<{ seconds: number }>,
): number {
  if (options.some((o) => o.seconds === seconds)) {
    return seconds;
  }
  return options.reduce((nearest, opt) =>
    Math.abs(opt.seconds - seconds) < Math.abs(nearest.seconds - seconds) ? opt : nearest,
  ).seconds;
}

/**
 * Snap an arbitrary stored duration to the nearest entry in
 * {@link ACCESS_RULE_DURATION_PRESETS}, so a value persisted outside the preset
 * set still renders against an option. Falls back to
 * {@link DEFAULT_ACCESS_RULE_DURATION_SECONDS} when no value is stored.
 */
export function snapToNearestAccessRuleDuration(seconds: number | null | undefined): number {
  if (seconds == null) {
    return DEFAULT_ACCESS_RULE_DURATION_SECONDS;
  }
  return snapToNearestDuration(seconds, ACCESS_RULE_DURATION_PRESETS);
}

/** A duration unit accepted by {@link Intl.NumberFormat}'s `unit` option. */
export type DurationUnit = "day" | "hour" | "minute" | "second";

/**
 * Picks the largest whole unit a duration divides evenly into, e.g. 3600
 * seconds -> `{ value: 1, unit: "hour" }`. Falls back to seconds when no
 * larger unit divides evenly.
 *
 * Kept as bare value/unit data (no formatting) so locale-specific rendering
 * — `Intl.NumberFormat`'s `style: "unit"` — happens where the display
 * concern belongs: {@link DurationShortPipe} in the `access-rules` view.
 */
export function pickDurationUnit(seconds: number): { value: number; unit: DurationUnit } {
  const divisions: { seconds: number; unit: DurationUnit }[] = [
    { seconds: 86400, unit: "day" },
    { seconds: 3600, unit: "hour" },
    { seconds: 60, unit: "minute" },
  ];
  for (const division of divisions) {
    if (seconds % division.seconds === 0) {
      return { value: seconds / division.seconds, unit: division.unit };
    }
  }
  return { value: seconds, unit: "second" };
}
