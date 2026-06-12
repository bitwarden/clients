import { AbstractControl, ValidationErrors } from "@angular/forms";

/**
 * Maximum lease/window length per the PAM server contract (24h). Both the
 * automatic duration and the human start/end span are capped at this value.
 */
export const MAX_LEASE_DURATION_SECONDS = 86_400;
export const MAX_LEASE_DURATION_MINUTES = MAX_LEASE_DURATION_SECONDS / 60;

/**
 * Preset durations offered by the duration picker on the automatic request path
 * (the cipher lease banner). Expressed in minutes to match that form's
 * `durationMinutes` control.
 */
export const LEASE_DURATION_PRESETS: { minutes: number; labelKey: string }[] = [
  { minutes: 15, labelKey: "requestAccessModalDuration15m" },
  { minutes: 30, labelKey: "requestAccessModalDuration30m" },
  { minutes: 60, labelKey: "requestAccessModalDuration1h" },
  { minutes: 240, labelKey: "requestAccessModalDuration4h" },
  { minutes: 480, labelKey: "requestAccessModalDuration8h" },
  { minutes: 1440, labelKey: "requestAccessModalDuration1d" },
];

/**
 * Preset durations offered by the access-rule dialog's default/max lease
 * pickers. A distinct list from {@link LEASE_DURATION_PRESETS}: expressed in
 * seconds (to match the rule's `*LeaseDurationSeconds` controls) and offering a
 * wider range, since an administrator configuring a rule can grant longer
 * windows than a self-service request.
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
 * Snap an arbitrary stored duration to the nearest entry in
 * {@link ACCESS_RULE_DURATION_PRESETS}, so a value persisted outside the preset
 * set still renders against an option. Falls back to
 * {@link DEFAULT_ACCESS_RULE_DURATION_SECONDS} when no value is stored.
 */
export function snapToNearestAccessRuleDuration(seconds: number | null | undefined): number {
  if (seconds == null) {
    return DEFAULT_ACCESS_RULE_DURATION_SECONDS;
  }
  if (ACCESS_RULE_DURATION_PRESETS.some((o) => o.seconds === seconds)) {
    return seconds;
  }
  return ACCESS_RULE_DURATION_PRESETS.reduce((nearest, opt) =>
    Math.abs(opt.seconds - seconds) < Math.abs(nearest.seconds - seconds) ? opt : nearest,
  ).seconds;
}

/** Compact lease-duration label, e.g. `15m`, `1h`, `4h`, `1d`. */
export function formatDurationShort(seconds: number): string {
  if (seconds % 86400 === 0) {
    return `${seconds / 86400}d`;
  }
  if (seconds % 3600 === 0) {
    return `${seconds / 3600}h`;
  }
  if (seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }
  return `${seconds}s`;
}

/**
 * Cross-field validator: when a custom window (date + start time + end time)
 * is fully populated, requires the end time to be strictly after the start.
 * Returns `null` when fields are incomplete so the validator doesn't fire
 * prematurely while the user is still filling in the form.
 */
export function endAfterStartValidator(control: AbstractControl): ValidationErrors | null {
  const { customDate, customStart, customEnd } = control.value as {
    customDate?: string;
    customStart?: string;
    customEnd?: string;
  };
  if (!customDate || !customStart || !customEnd) {
    return null;
  }
  const start = new Date(`${customDate}T${customStart}`).getTime();
  const end = new Date(`${customDate}T${customEnd}`).getTime();
  return end > start ? null : { customWindow: "endBeforeStart" };
}

/**
 * Cross-field validator: rejects custom windows whose span exceeds the
 * server's 24h cap. Pairs with {@link endAfterStartValidator}; both must pass
 * for the form to be submittable.
 */
export function windowWithinMaxDurationValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const { customDate, customStart, customEnd } = control.value as {
    customDate?: string;
    customStart?: string;
    customEnd?: string;
  };
  if (!customDate || !customStart || !customEnd) {
    return null;
  }
  const start = new Date(`${customDate}T${customStart}`).getTime();
  const end = new Date(`${customDate}T${customEnd}`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return null;
  }
  return end - start > MAX_LEASE_DURATION_SECONDS * 1000
    ? { customWindow: "exceedsMaxDuration" }
    : null;
}

/** Returns `YYYY-MM-DD` for a Date (local time). */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns `HH:mm` for a Date (local time). */
export function toTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Seed values for a custom access window starting now and spanning
 * `durationMinutes`. The end time is clamped to `23:59` on the start date when
 * the window would cross midnight, so the default doesn't trip
 * {@link endAfterStartValidator} on first paint (multi-day windows are tracked
 * as a separate UX defect on the validator). Returns the three reactive-form
 * control values (`customDate`, `customStart`, `customEnd`).
 */
export function defaultWindowFormValues(durationMinutes = 60): {
  customDate: string;
  customStart: string;
  customEnd: string;
} {
  const now = new Date();
  const end = new Date(now.getTime() + durationMinutes * 60_000);
  const sameDay =
    end.getFullYear() === now.getFullYear() &&
    end.getMonth() === now.getMonth() &&
    end.getDate() === now.getDate();
  return {
    customDate: toDateString(now),
    customStart: toTimeString(now),
    customEnd: sameDay ? toTimeString(end) : "23:59",
  };
}
