/**
 * The access-rule edit form's lease duration presets, wider than a requester's since an admin can
 * grant longer windows.
 */
export const ACCESS_RULE_DURATION_PRESETS: ReadonlyArray<{ seconds: number }> = [
  { seconds: 15 * 60 },
  { seconds: 30 * 60 },
  { seconds: 60 * 60 },
  { seconds: 4 * 60 * 60 },
  { seconds: 8 * 60 * 60 },
  { seconds: 24 * 60 * 60 },
  { seconds: 2 * 24 * 60 * 60 },
  { seconds: 7 * 24 * 60 * 60 },
  { seconds: 30 * 24 * 60 * 60 },
];

/** Default lease duration (1h) for a new access rule with no stored value. */
export const DEFAULT_ACCESS_RULE_DURATION_SECONDS = 60 * 60;

/**
 * The requester's duration presets. Topping out at a day is a default, not a limit, since
 * {@link requestDurationOptions} still offers a rule's higher cap.
 */
export const REQUEST_ACCESS_DURATION_PRESETS: ReadonlyArray<{ seconds: number }> = [
  { seconds: 15 * 60 },
  { seconds: 30 * 60 },
  { seconds: 60 * 60 },
  { seconds: 4 * 60 * 60 },
  { seconds: 8 * 60 * 60 },
  { seconds: 24 * 60 * 60 },
];

/** The automatic form's placeholder until the pre-check supplies the rule's own default. */
export const DEFAULT_REQUEST_ACCESS_DURATION_SECONDS = 60 * 60;

/** The server's ceiling, which its pre-check reports as the cap of a rule with no maximum. */
const GLOBAL_MAX_LEASE_SECONDS = 365 * 24 * 60 * 60;

/** A requester duration option. */
export type RequestDurationOption = { seconds: number };

/**
 * The presets under `maxSeconds`, plus the cap and default themselves, so the picker is never empty
 * and the default is always an option. The server's ceiling isn't offered, since it stands for no cap.
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

  const cap = maxSeconds < GLOBAL_MAX_LEASE_SECONDS ? [maxSeconds] : [];
  for (const seconds of [...cap, defaultSeconds]) {
    if (seconds > 0 && seconds <= maxSeconds && !options.has(seconds)) {
      options.set(seconds, { seconds });
    }
  }

  return [...options.values()].sort((a, b) => a.seconds - b.seconds);
}

/** Extension lengths, in seconds: the choices for a rule's cap, and a requester's up to the cap. */
export const EXTENSION_DURATION_OPTIONS: ReadonlyArray<{ seconds: number }> = [
  { seconds: 30 * 60 },
  { seconds: 60 * 60 },
  { seconds: 2 * 60 * 60 },
  { seconds: 4 * 60 * 60 },
  { seconds: 8 * 60 * 60 },
];

/** Default maximum extension length offered when a rule first enables extensions (1h). */
export const DEFAULT_MAX_EXTENSION_DURATION_SECONDS = 60 * 60;

/**
 * The extension presets up to the rule's cap, plus the cap itself when no preset matches it, so the
 * picker offers only lengths the server accepts and is never empty.
 */
export function extensionDurationOptions(maxSeconds: number): RequestDurationOption[] {
  const options: RequestDurationOption[] = EXTENSION_DURATION_OPTIONS.filter(
    (preset) => preset.seconds <= maxSeconds,
  );
  if (!options.some((option) => option.seconds === maxSeconds)) {
    options.push({ seconds: maxSeconds });
  }
  return options;
}

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
