import type { BadgeVariant, BitwardenIcon } from "@bitwarden/components";

import { QuartzSchedulePreset, RotationConfigId, RotationConfig, TargetSystem } from "../rotation";
import { RotationConfigDescription } from "../rotation-sdk.service";
import { targetSystemMethodLabelKey } from "../target-systems/target-system-label";

/**
 * The one status a managed credential row resolves to, which the status column sorts and filters
 * on. A paused row with a running job also carries a pause marker; see
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
   * Ascending sort position, following {@link resolveRotationStatus}'s precedence. Sorting on the
   * label key or the rendered label would order by spelling, differently in every locale.
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
      labelKey: "pamRotationConfigRotatingBadge",
      variant: "primary",
      icon: "bwi-refresh",
      sortOrder: 1,
    },
    [RotationRowStatus.ManualRotation]: {
      status: RotationRowStatus.ManualRotation,
      labelKey: "pamRotationConfigRotationDueBadge",
      variant: "warning",
      icon: "bwi-clock",
      sortOrder: 3,
    },
  } as const);

/** Every status a managed credential row can be in, in the order the status filter offers them. */
export const ROTATION_STATUS_BADGES = Object.freeze(Object.values(STATUS_BADGES));

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

export function rotationStatusBadge(status: RotationRowStatus): RotationStatusBadge {
  return STATUS_BADGES[status];
}

/**
 * A managed credential row. Every sortable column maps to a field, and dates carry epoch ms for
 * sorting beside the ISO string for display.
 */
export type RotationConfigRow = {
  id: RotationConfigId;
  config: RotationConfig;
  /** The decrypted cipher name, or the cipher id until the vault read resolves it. */
  cipherName: string;
  targetSystemName: string;
  methodLabelKey: string;
  status: RotationRowStatus;
  statusBadge: RotationStatusBadge;
  statusLabelKey: string;
  /** The Status column's sort key, kept apart since the filter matches {@link statusLabelKey}. */
  statusSortOrder: number;
  /**
   * Paused with a job still running, which the status badge can't show because the job takes
   * precedence. Kept apart from {@link status} so sort and filter still see the four statuses.
   */
  pausedWhileRotating: boolean;
  /**
   * A preset's i18n key, or a custom cron verbatim. No schedule maps to `pamRotationScheduleNone`,
   * which the template renders as a dash.
   */
  scheduleLabelKeyOrCron: string;
  rotateOnAccessEnd: boolean;
  lastRotationAtMs: number | null;
  lastRotationAt: string | null;
  nextRotationAtMs: number | null;
  nextRotationAt: string | null;
  hasActiveJob: boolean;
  awaitingManualRotation: boolean;
  canRotateNow: boolean;
  canRecordManual: boolean;
  mutationsLocked: boolean;
  canPause: boolean;
  canResume: boolean;
};

/**
 * The SDK decides the actions and schedule preset in `description`; this maps them onto i18n keys
 * and sortable columns.
 */
export function buildRotationConfigRow(
  config: RotationConfig,
  targetSystem: TargetSystem | undefined,
  cipherName: string | undefined,
  description: RotationConfigDescription,
): RotationConfigRow {
  const scheduleLabelKeyOrCron = scheduleLabel(
    description.schedulePreset,
    config.scheduleCron ?? null,
  );

  const status = resolveRotationStatus(config);
  const statusBadge = rotationStatusBadge(status);

  const lastRotationAtMs = config.lastRotationAt != null ? Date.parse(config.lastRotationAt) : null;
  const nextRotationAtMs = config.nextRotationAt != null ? Date.parse(config.nextRotationAt) : null;

  return {
    id: config.id,
    config,
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
    lastRotationAt: config.lastRotationAt ?? null,
    nextRotationAtMs: Number.isNaN(nextRotationAtMs) ? null : nextRotationAtMs,
    nextRotationAt: config.nextRotationAt ?? null,
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
    return cron ?? "";
  }
  return PRESET_LABEL_KEYS[preset];
}
