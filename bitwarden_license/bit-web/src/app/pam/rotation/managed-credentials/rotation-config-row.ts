import { QuartzSchedulePreset, presetForCron } from "../helpers/quartz-cron";
import {
  canPause,
  canRecordManual,
  canResume,
  canRotateNow,
  mutationsLocked,
} from "../helpers/rotation-config-actions";
import { RotationConfigResponse } from "../responses/rotation-config.response";
import { TargetSystemResponse } from "../responses/target-system.response";
import { TargetSystemMethod } from "../rotation";

/**
 * Presentation-ready flattened view of a rotation config row.
 * All sortable columns map to a property here; date columns expose
 * epoch milliseconds for chronological sorting + ISO strings for the date pipe.
 */
export type RotationConfigRow = {
  id: string;
  config: RotationConfigResponse;
  /** Decrypted cipher name resolved from OrgCiphersService; falls back to config.cipherId. */
  cipherName: string;
  targetSystemName: string;
  /**
   * i18n label key for the target system's method (Automatic / Manual).
   * Template binds `row.methodLabelKey | i18n`.
   */
  methodLabelKey: string;
  /**
   * i18n label key for the config's enabled/paused state.
   * `"pamRotationConfigStatusActive"` or `"pamRotationConfigStatusPaused"`.
   */
  statusLabelKey: string;
  /**
   * For preset crons: the i18n key for the preset label (e.g. `"pamRotationScheduleDaily"`).
   * For a custom cron: the raw cron string itself (displayed verbatim).
   * For null/none: `"pamRotationScheduleNone"` — the template renders an em-dash.
   */
  scheduleLabelKeyOrCron: string;
  rotateOnAccessEnd: boolean;
  /** Epoch milliseconds of lastRotationAt, or null — used for column sorting. */
  lastRotationAtMs: number | null;
  /** ISO string from the config, passed to the date pipe. */
  lastRotationAt: string | null;
  /** Epoch milliseconds of nextRotationAt, or null — used for column sorting. */
  nextRotationAtMs: number | null;
  /** ISO string from the config, passed to the date pipe. */
  nextRotationAt: string | null;
  hasActiveJob: boolean;
  awaitingManualRotation: boolean;
  /** Computed from canRotateNow() helper + resolved target status. */
  canRotateNow: boolean;
  canRecordManual: boolean;
  mutationsLocked: boolean;
  canPause: boolean;
  canResume: boolean;
};

/**
 * Build a presentation row from a rotation config + its resolved target system + cipher name.
 *
 * Pure function — no side effects, no Angular dependencies.
 *
 * @param config - The raw rotation config from the API.
 * @param targetSystem - The resolved target system, or undefined if not yet loaded.
 * @param cipherName - The decrypted cipher name, or undefined if not yet resolved.
 */
export function buildRotationConfigRow(
  config: RotationConfigResponse,
  targetSystem: TargetSystemResponse | undefined,
  cipherName: string | undefined,
): RotationConfigRow {
  const preset = presetForCron(config.scheduleCron);
  const scheduleLabelKeyOrCron = scheduleLabel(preset, config.scheduleCron);

  const lastRotationAtMs = config.lastRotationAt != null ? Date.parse(config.lastRotationAt) : null;
  const nextRotationAtMs = config.nextRotationAt != null ? Date.parse(config.nextRotationAt) : null;

  return {
    id: config.id,
    config,
    cipherName: cipherName ?? config.cipherId,
    targetSystemName: targetSystem?.name ?? config.targetSystemName,
    methodLabelKey: methodLabel(config.targetSystemMethod),
    statusLabelKey: config.enabled
      ? "pamRotationConfigStatusActive"
      : "pamRotationConfigStatusPaused",
    scheduleLabelKeyOrCron,
    rotateOnAccessEnd: config.rotateOnAccessEnd,
    lastRotationAtMs: Number.isNaN(lastRotationAtMs) ? null : lastRotationAtMs,
    lastRotationAt: config.lastRotationAt,
    nextRotationAtMs: Number.isNaN(nextRotationAtMs) ? null : nextRotationAtMs,
    nextRotationAt: config.nextRotationAt,
    hasActiveJob: config.hasActiveJob,
    awaitingManualRotation: config.awaitingManualRotation,
    canRotateNow: canRotateNow(config, targetSystem?.status),
    canRecordManual: canRecordManual(config),
    mutationsLocked: mutationsLocked(config),
    canPause: canPause(config),
    canResume: canResume(config),
  };
}

function methodLabel(method: RotationConfigResponse["targetSystemMethod"]): string {
  return method === TargetSystemMethod.Automatic
    ? "pamTargetSystemMethodAutomatic"
    : "pamTargetSystemMethodManual";
}

const PRESET_LABEL_KEYS: Record<QuartzSchedulePreset, string> = {
  [QuartzSchedulePreset.None]: "pamRotationScheduleNone",
  [QuartzSchedulePreset.Hourly]: "pamRotationScheduleHourly",
  [QuartzSchedulePreset.Every6Hours]: "pamRotationScheduleEvery6Hours",
  [QuartzSchedulePreset.Daily]: "pamRotationScheduleDaily",
  [QuartzSchedulePreset.Weekly]: "pamRotationScheduleWeekly",
  [QuartzSchedulePreset.Monthly]: "pamRotationScheduleMonthly",
  [QuartzSchedulePreset.Custom]: "pamRotationScheduleCustom",
};

function scheduleLabel(preset: QuartzSchedulePreset, cron: string | null): string {
  if (preset === QuartzSchedulePreset.None) {
    return PRESET_LABEL_KEYS[QuartzSchedulePreset.None];
  }
  if (preset === QuartzSchedulePreset.Custom) {
    // Return the raw cron string for verbatim display in the template.
    return cron ?? "";
  }
  return PRESET_LABEL_KEYS[preset];
}

/** Exposed for template use: the set of non-custom preset label keys. */
export const PRESET_I18N_KEYS = PRESET_LABEL_KEYS;

/** True when scheduleLabelKeyOrCron is an i18n key (not a raw cron string). */
export function isScheduleI18nKey(row: Pick<RotationConfigRow, "scheduleLabelKeyOrCron">): boolean {
  return Object.values(PRESET_LABEL_KEYS).includes(row.scheduleLabelKeyOrCron);
}

/** True when the row represents a manual-method config waiting for operator action. */
export function isManualTarget(row: Pick<RotationConfigRow, "canRecordManual">): boolean {
  return row.canRecordManual;
}

/**
 * Export a sentinel string used by the template to check whether
 * scheduleLabelKeyOrCron is the "none" key (rendered as em-dash).
 */
export const SCHEDULE_NONE_KEY = PRESET_LABEL_KEYS[QuartzSchedulePreset.None];
