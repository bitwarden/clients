import type { BadgeVariant, BitwardenIcon } from "@bitwarden/components";

import { QuartzSchedulePreset, RotationConfigId, RotationConfig, TargetSystem } from "../rotation";
import { RotationConfigDescription } from "../rotation-sdk.service";
import { targetSystemMethodLabelKey } from "../target-systems/target-system-label";

/**
 * The single status a managed credential row resolves to. Mutually exclusive: one status wins, and
 * it is the only one the status column sorts and the status filter matches on.
 *
 * A row may still carry a companion pause marker alongside the status badge; see
 * {@link RotationConfigRow.pausedWhileRotating}.
 */
export const RotationRowStatus = Object.freeze({
  Active: "active",
  Paused: "paused",
  Rotating: "rotating",
  ManualRotation: "manual-rotation",
} as const);
export type RotationRowStatus = (typeof RotationRowStatus)[keyof typeof RotationRowStatus];

/** How a resolved status renders: one label, one colour, one icon. */
export type RotationStatusBadge = {
  status: RotationRowStatus;
  labelKey: string;
  variant: BadgeVariant;
  icon: BitwardenIcon;
  /**
   * Where this status sits when the Status column is sorted, ascending.
   *
   * The order is {@link resolveRotationStatus}'s own precedence, so the column reads from the
   * status most in need of an admin's attention down to the steady state. Sorting on the label
   * key instead would order by the spelling of an i18n identifier, and sorting on the rendered
   * label would put the column in a different order in every locale.
   */
  sortOrder: number;
};

const STATUS_BADGES: Readonly<Record<RotationRowStatus, Readonly<RotationStatusBadge>>> =
  Object.freeze({
    [RotationRowStatus.Active]: {
      status: RotationRowStatus.Active,
      labelKey: "pamRotationConfigStatusActive",
      variant: "success",
      icon: "bwi-check-circle",
      sortOrder: 4,
    },
    [RotationRowStatus.Paused]: {
      status: RotationRowStatus.Paused,
      labelKey: "pamRotationConfigStatusPaused",
      variant: "subtle",
      icon: "bwi-minus-circle",
      sortOrder: 2,
    },
    [RotationRowStatus.Rotating]: {
      status: RotationRowStatus.Rotating,
      labelKey: "pamRotationConfigInProgress",
      variant: "primary",
      icon: "bwi-refresh",
      sortOrder: 1,
    },
    [RotationRowStatus.ManualRotation]: {
      status: RotationRowStatus.ManualRotation,
      labelKey: "pamRotationConfigManualDue",
      variant: "warning",
      icon: "bwi-clock",
      sortOrder: 3,
    },
  } as const);

/** Every status a managed credential row can be in, in the order the status filter offers them. */
export const ROTATION_STATUS_BADGES = Object.freeze(Object.values(STATUS_BADGES));

/** Resolve the one status a config is in. */
export function resolveRotationStatus(
  config: Pick<RotationConfig, "enabled" | "hasActiveJob" | "awaitingManualRotation">,
): RotationRowStatus {
  if (config.hasActiveJob) {
    return RotationRowStatus.Rotating;
  }
  if (!config.enabled) {
    return RotationRowStatus.Paused;
  }
  if (config.awaitingManualRotation) {
    return RotationRowStatus.ManualRotation;
  }
  return RotationRowStatus.Active;
}

/** The badge for a resolved status. */
export function rotationStatusBadge(status: RotationRowStatus): RotationStatusBadge {
  return STATUS_BADGES[status];
}

/**
 * Presentation-ready flattened view of a rotation config row.
 * All sortable columns map to a property here; date columns expose
 * epoch milliseconds for chronological sorting + ISO strings for the date pipe.
 */
export type RotationConfigRow = {
  id: RotationConfigId;
  config: RotationConfig;
  /** Decrypted cipher name resolved from OrgCiphersService; falls back to config.cipherId. */
  cipherName: string;
  targetSystemName: string;
  /**
   * i18n label key for the target system's method (Automatic / Manual).
   * Template binds `row.methodLabelKey | i18n`.
   */
  methodLabelKey: string;
  /** The one status this row is in. See {@link resolveRotationStatus}. */
  status: RotationRowStatus;
  /** How {@link status} renders: the row's only badge. */
  statusBadge: RotationStatusBadge;
  /** i18n label key of {@link statusBadge}. */
  statusLabelKey: string;
  /**
   * {@link RotationStatusBadge.sortOrder} of {@link statusBadge}, the property the Status column
   * sorts on. A field of its own because {@link statusLabelKey} is what the status filter chip
   * matches against and must keep meaning the badge's i18n key.
   */
  statusSortOrder: number;
  /**
   * Whether the row is paused while a claimed job is still running, the one case where the single
   * status badge cannot show the pause: {@link resolveRotationStatus} gives the in-flight job
   * precedence, so the row would otherwise read as merely rotating.
   *
   * Kept apart from {@link status}, {@link statusBadge} and {@link statusLabelKey} so the status
   * column's sort and the status filter still see exactly the four resolved statuses.
   */
  pausedWhileRotating: boolean;
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
 * Build a presentation row from a rotation config, its resolved target system, its cipher name,
 * and the SDK's description of it.
 *
 * Pure function — no side effects, no Angular dependencies. Which actions the config offers and
 * which preset its cron matches are decided by the SDK and arrive in `description`; this only
 * maps that onto i18n keys and sortable columns.
 *
 * @param config - The rotation config.
 * @param targetSystem - The resolved target system, or undefined if not yet loaded.
 * @param cipherName - The decrypted cipher name, or undefined if not yet resolved.
 * @param description - The SDK-derived actions and schedule preset for this config.
 */
export function buildRotationConfigRow(
  config: RotationConfig,
  targetSystem: TargetSystem | undefined,
  cipherName: string | undefined,
  description: RotationConfigDescription,
): RotationConfigRow {
  const scheduleLabelKeyOrCron = scheduleLabel(description.schedulePreset, config.scheduleCron);

  const status = resolveRotationStatus(config);
  const statusBadge = rotationStatusBadge(status);

  const lastRotationAtMs = config.lastRotationAt != null ? Date.parse(config.lastRotationAt) : null;
  const nextRotationAtMs = config.nextRotationAt != null ? Date.parse(config.nextRotationAt) : null;

  return {
    id: config.id,
    config,
    // Falls back to the raw id when the vault read hasn't resolved a name yet.
    cipherName: cipherName ?? String(config.cipherId),
    targetSystemName: targetSystem?.name ?? config.targetSystemName,
    methodLabelKey:
      targetSystemMethodLabelKey(config.targetSystemMethod) ?? "pamTargetSystemMethodManual",
    status,
    statusBadge,
    statusLabelKey: statusBadge.labelKey,
    statusSortOrder: statusBadge.sortOrder,
    pausedWhileRotating: !config.enabled && status === RotationRowStatus.Rotating,
    scheduleLabelKeyOrCron,
    rotateOnAccessEnd: config.rotateOnAccessEnd,
    lastRotationAtMs: Number.isNaN(lastRotationAtMs) ? null : lastRotationAtMs,
    lastRotationAt: config.lastRotationAt,
    nextRotationAtMs: Number.isNaN(nextRotationAtMs) ? null : nextRotationAtMs,
    nextRotationAt: config.nextRotationAt,
    hasActiveJob: config.hasActiveJob,
    awaitingManualRotation: config.awaitingManualRotation,
    canRotateNow: description.actions.canRotateNow,
    canRecordManual: description.actions.canRecordManual,
    mutationsLocked: description.actions.mutationsLocked,
    canPause: description.actions.canPause,
    canResume: description.actions.canResume,
  };
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
