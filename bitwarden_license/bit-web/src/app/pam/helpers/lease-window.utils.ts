/**
 * The access-rule edit form's lease duration presets, wider than a requester's since an admin can
 * grant longer windows.
 */
export const ACCESS_RULE_DURATION_PRESETS: ReadonlyArray<{ seconds: number; labelKey: string }> = [
  { seconds: 15 * 60, labelKey: "pamAccessRuleDuration15m" },
  { seconds: 30 * 60, labelKey: "pamAccessRuleDuration30m" },
  { seconds: 60 * 60, labelKey: "pamAccessRuleDuration1h" },
  { seconds: 4 * 60 * 60, labelKey: "pamAccessRuleDuration4h" },
  { seconds: 8 * 60 * 60, labelKey: "pamAccessRuleDuration8h" },
  { seconds: 24 * 60 * 60, labelKey: "pamAccessRuleDuration1d" },
  { seconds: 2 * 24 * 60 * 60, labelKey: "pamAccessRuleDuration2d" },
  { seconds: 7 * 24 * 60 * 60, labelKey: "pamAccessRuleDuration7d" },
  { seconds: 30 * 24 * 60 * 60, labelKey: "pamAccessRuleDuration30d" },
];

/** Default lease duration (1h) for a new access rule with no stored value. */
export const DEFAULT_ACCESS_RULE_DURATION_SECONDS = 60 * 60;

/**
 * The requester's duration presets. Topping out at a day is a default, not a limit, since
 * {@link requestDurationOptions} still offers a rule's higher cap.
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

/** The automatic form's placeholder until the pre-check supplies the rule's own default. */
export const DEFAULT_REQUEST_ACCESS_DURATION_SECONDS = 60 * 60;

/** A requester duration option; one without a `labelKey` is formatted from its value. */
export type RequestDurationOption = { seconds: number; labelKey?: string };

/**
 * The presets under `maxSeconds`, plus the cap and default themselves, so the picker is never empty
 * and the default is always an option.
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

/** Admin-selectable maximum extension lengths, in seconds. */
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
 * Snaps to the nearest option, so a value persisted outside the set still renders. Assumes a
 * non-empty `options`.
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

export function snapToNearestAccessRuleDuration(seconds: number | null | undefined): number {
  if (seconds == null) {
    return DEFAULT_ACCESS_RULE_DURATION_SECONDS;
  }
  return snapToNearestDuration(seconds, ACCESS_RULE_DURATION_PRESETS);
}

/** A duration unit accepted by {@link Intl.NumberFormat}'s `unit` option. */
export type DurationUnit = "day" | "hour" | "minute" | "second";

/** The largest unit `seconds` divides evenly into, e.g. 3600 is `{ value: 1, unit: "hour" }`. */
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
