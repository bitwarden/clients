/**
 * Preset schedule labels and their corresponding Quartz 6-field cron expressions.
 *
 * Quartz cron format: seconds minutes hours day-of-month month day-of-week [year]
 * (6 or 7 whitespace-separated fields, unlike the 5-field UNIX cron).
 *
 * The server enforces a 15-minute interval floor; "None" means no scheduled
 * rotation (manual / access-end only).
 */
export const QuartzSchedulePreset = Object.freeze({
  None: "none",
  Hourly: "hourly",
  Every6Hours: "every6Hours",
  Daily: "daily",
  Weekly: "weekly",
  Monthly: "monthly",
  Custom: "custom",
} as const);
export type QuartzSchedulePreset = (typeof QuartzSchedulePreset)[keyof typeof QuartzSchedulePreset];

/**
 * The canonical Quartz cron strings for each named preset.
 * Keyed by the preset value (excluding None and Custom, which have no fixed expression).
 */
export const PRESET_CRONS: Readonly<
  Record<"hourly" | "every6Hours" | "daily" | "weekly" | "monthly", string>
> = Object.freeze({
  hourly: "0 0 * * * ?",
  every6Hours: "0 0 */6 * * ?",
  daily: "0 0 0 * * ?",
  weekly: "0 0 0 ? * SUN",
  monthly: "0 0 0 1 * ?",
});

/**
 * Derive the preset that best describes a stored cron expression.
 *
 * - `null` → `None` (no scheduled rotation)
 * - Exact match to a PRESET_CRONS value → that preset
 * - Any other non-empty string → `Custom`
 */
export function presetForCron(cron: string | null): QuartzSchedulePreset {
  if (cron === null) {
    return QuartzSchedulePreset.None;
  }
  const normalised = cron.trim();
  for (const [preset, expr] of Object.entries(PRESET_CRONS) as [
    keyof typeof PRESET_CRONS,
    string,
  ][]) {
    if (normalised === expr) {
      return preset as QuartzSchedulePreset;
    }
  }
  return QuartzSchedulePreset.Custom;
}

/**
 * Lightly validate that a string looks like a Quartz cron expression.
 *
 * Accepts 6- or 7-field expressions (Quartz extended format). Each field must
 * contain only alphanumerics and the characters `* / , - ? # L W`. This is an
 * advisory client-side check; the server is authoritative.
 */
export function isLikelyQuartzCron(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  const fields = trimmed.split(/\s+/);
  if (fields.length < 6 || fields.length > 7) {
    return false;
  }
  const validField = /^[0-9A-Za-z*/,\-?#LW]+$/;
  return fields.every((f) => validField.test(f));
}
