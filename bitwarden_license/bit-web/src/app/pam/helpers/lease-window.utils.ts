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
  { seconds: 24 * 60 * 60, labelKey: "pamAccessRuleDuration1d" },
  { seconds: 7 * 24 * 60 * 60, labelKey: "pamAccessRuleDuration7d" },
];

/** Default lease duration (1h) for a new access rule with no stored value. */
export const DEFAULT_ACCESS_RULE_DURATION_SECONDS = 60 * 60;

/**
 * Preset durations offered by the requester's own duration picker on the automatic request path
 * (the cipher-view banner). A narrower list than {@link ACCESS_RULE_DURATION_PRESETS}: an
 * administrator configuring a rule can grant longer windows than a member may ask for in
 * self-service, and the top of this list is the server's 24h cap
 * ({@link MAX_REQUEST_ACCESS_WINDOW_SECONDS}).
 */
export const REQUEST_ACCESS_DURATION_PRESETS: ReadonlyArray<{
  seconds: number;
  labelKey: string;
}> = [
  { seconds: 15 * 60, labelKey: "requestAccessModalDuration15m" },
  { seconds: 30 * 60, labelKey: "requestAccessModalDuration30m" },
  { seconds: 60 * 60, labelKey: "requestAccessModalDuration1h" },
  { seconds: 4 * 60 * 60, labelKey: "requestAccessModalDuration4h" },
  { seconds: 8 * 60 * 60, labelKey: "requestAccessModalDuration8h" },
  { seconds: 24 * 60 * 60, labelKey: "requestAccessModalDuration1d" },
];

/**
 * Duration pre-selected when the requester first opens the automatic-path form (1h).
 *
 * Only the fallback for a pre-check that names no default of its own. The governing rule's default
 * (published as `AccessPreCheckView.defaultDurationSeconds`) is the authority — preferring this
 * constant over it is what let a rule configured for 15 minutes still pre-fill an hour.
 */
export const DEFAULT_REQUEST_ACCESS_DURATION_SECONDS = 60 * 60;

/** One entry in the requester's duration picker. A `labelKey`-less entry is formatted from its value. */
export type RequestDurationOption = { seconds: number; labelKey?: string };

/**
 * The duration options a requester may pick from under a rule capped at `maxSeconds`, pre-selecting
 * `defaultSeconds`.
 *
 * {@link REQUEST_ACCESS_DURATION_PRESETS} narrowed to what the cap allows, then widened to include
 * the cap and the default themselves. The widening matters twice: it keeps the picker non-empty for
 * a cap below the smallest preset (which would otherwise offer nothing at all), and it guarantees
 * the pre-selected default is a real option, so the select never renders blank. Every admin-settable
 * cap happens to coincide with a preset today, but a cap written straight to the API need not.
 *
 * Entries the preset list does not cover carry no `labelKey`; the template formats those from their
 * value instead. Callers pass bounds already resolved server-side, so no clamping happens here
 * beyond dropping over-cap presets.
 */
export function requestDurationOptions(
  maxSeconds: number,
  defaultSeconds: number,
): RequestDurationOption[] {
  const options = new Map<number, RequestDurationOption>();

  for (const preset of REQUEST_ACCESS_DURATION_PRESETS) {
    if (preset.seconds <= maxSeconds) {
      options.set(preset.seconds, preset);
    }
  }

  for (const seconds of [maxSeconds, defaultSeconds]) {
    if (seconds > 0 && seconds <= maxSeconds && !options.has(seconds)) {
      options.set(seconds, { seconds });
    }
  }

  return [...options.values()].sort((a, b) => a.seconds - b.seconds);
}

/** Admin-selectable maximum extension lengths, in seconds (30m–8h). */
export const EXTENSION_DURATION_OPTIONS: ReadonlyArray<{ seconds: number; labelKey: string }> = [
  { seconds: 30 * 60, labelKey: "pamAccessRuleDuration30m" },
  { seconds: 60 * 60, labelKey: "pamAccessRuleDuration1h" },
  { seconds: 2 * 60 * 60, labelKey: "pamAccessRuleDuration2h" },
  { seconds: 4 * 60 * 60, labelKey: "pamAccessRuleDuration4h" },
  { seconds: 8 * 60 * 60, labelKey: "pamAccessRuleDuration8h" },
];

/** Default maximum extension length offered when a rule first enables extensions (1h). */
export const DEFAULT_MAX_EXTENSION_DURATION_SECONDS = 60 * 60;

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
 * concern belongs: the `date/` duration pipes, spelled out (`durationLong`)
 * in the `access-rules` table and compact (`durationShort`) in the
 * `access-requests` tabs.
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
