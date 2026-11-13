import type { QuartzSchedulePreset, RotationScheduleClient } from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared/pam-input-error";
import { sanitizeUntrusted } from "../shared/sanitize-untrusted";

/** The presets an operator may name. `custom` is what the SDK reports for any other cron. */
export const ROTATION_SCHEDULE_PRESETS = Object.freeze([
  "none",
  "hourly",
  "every6_hours",
  "daily",
  "weekly",
  "monthly",
] as const satisfies readonly QuartzSchedulePreset[]);

/** The longest raw cron accepted. A Quartz expression is far shorter. */
const MAX_CRON_LENGTH = 200;

export interface ResolvedRotationSchedule {
  /** The Quartz cron to send, or `undefined` for no scheduled rotation. */
  readonly cron: string | undefined;
  /** The SDK's name for the cron: a preset, or `custom`. */
  readonly preset: QuartzSchedulePreset;
  /**
   * False for a raw cron that does not look like a Quartz expression. Advisory only: the
   * server decides whether the cron is valid.
   */
  readonly likelyQuartz: boolean;
}

function isPresetName(value: string): value is (typeof ROTATION_SCHEDULE_PRESETS)[number] {
  return (ROTATION_SCHEDULE_PRESETS as readonly string[]).includes(value);
}

/**
 * Resolves `--schedule`: a preset name goes through `cron_for_preset`, anything else is taken as
 * a raw Quartz cron. Pure: it makes no request.
 * @throws PamInputError when the value is empty or longer than {@link MAX_CRON_LENGTH}.
 */
export function resolveRotationSchedule(
  schedule: RotationScheduleClient,
  value: string | undefined,
): ResolvedRotationSchedule {
  const text = value?.trim() ?? "";
  if (text.length === 0) {
    throw new PamInputError(
      `Give a schedule: one of ${ROTATION_SCHEDULE_PRESETS.join(", ")}, or a Quartz cron expression.`,
    );
  }
  if (text.length > MAX_CRON_LENGTH) {
    throw new PamInputError(`The schedule is longer than ${MAX_CRON_LENGTH} characters.`);
  }

  const name = text.toLowerCase();
  if (isPresetName(name)) {
    return { cron: schedule.cron_for_preset(name), preset: name, likelyQuartz: true };
  }
  return {
    cron: text,
    preset: schedule.preset_for_cron(text),
    likelyQuartz: schedule.is_likely_quartz_cron(text),
  };
}

/** The advisory sentence for a cron that does not look like Quartz, else `undefined`. */
export function scheduleWarning(resolved: ResolvedRotationSchedule): string | undefined {
  return resolved.likelyQuartz
    ? undefined
    : `\`${sanitizeUntrusted(resolved.cron, 64)}\` does not look like a 6- or 7-field Quartz cron expression. The server decides whether it is accepted.`;
}
