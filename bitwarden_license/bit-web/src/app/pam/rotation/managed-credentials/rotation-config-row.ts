import type { BadgeVariant, BitwardenIcon } from "@bitwarden/components";

import {
  AccessConnector,
  AccessConnectorStatus,
  QuartzSchedulePreset,
  RotationConfigId,
  RotationConfigView,
  TargetSystemId,
  TargetSystemMethod,
  TargetSystemView,
} from "../rotation";
import { RotationConfigDescription } from "../rotation-sdk.service";
import { targetSystemMethodLabelKey } from "../target-systems/target-system-label";

/**
 * The one status a managed credential row resolves to, which the status column sorts and filters
 * on. See {@link resolveRotationStatus} for which status wins when several apply.
 */
export const RotationRowStatus = Object.freeze({
  Failed: "failed",
  NotConnected: "not-connected",
  RotationDue: "rotation-due",
  Rotating: "rotating",
  Paused: "paused",
  ManualRotation: "manual-rotation",
  Active: "active",
} as const);
export type RotationRowStatus = (typeof RotationRowStatus)[keyof typeof RotationRowStatus];

/** How a resolved status renders: one label, one colour, one icon. */
export type RotationStatusBadge = {
  status: RotationRowStatus;
  labelKey: string;
  variant: BadgeVariant;
  icon: BitwardenIcon;
  /**
   * Ascending sort position by urgency, which differs from the precedence in
   * {@link resolveRotationStatus}. Sorting on the label key or the rendered label would order by
   * spelling, differently in every locale.
   */
  sortOrder: number;
};

const STATUS_BADGES: Readonly<Record<RotationRowStatus, Readonly<RotationStatusBadge>>> =
  Object.freeze({
    [RotationRowStatus.Failed]: {
      status: RotationRowStatus.Failed,
      labelKey: "pamRotationConfigStatusFailed",
      variant: "danger",
      icon: "bwi-error",
      sortOrder: 1,
    },
    [RotationRowStatus.NotConnected]: {
      status: RotationRowStatus.NotConnected,
      labelKey: "pamRotationConfigStatusNotConnected",
      variant: "warning",
      icon: "bwi-warning",
      sortOrder: 2,
    },
    [RotationRowStatus.RotationDue]: {
      status: RotationRowStatus.RotationDue,
      labelKey: "pamRotationConfigRotationDueBadge",
      variant: "warning",
      icon: "bwi-calendar",
      sortOrder: 3,
    },
    [RotationRowStatus.Rotating]: {
      status: RotationRowStatus.Rotating,
      labelKey: "pamRotationConfigRotatingBadge",
      variant: "primary",
      icon: "bwi-refresh",
      sortOrder: 4,
    },
    [RotationRowStatus.Paused]: {
      status: RotationRowStatus.Paused,
      labelKey: "pamRotationConfigStatusPaused",
      variant: "subtle",
      icon: "bwi-pause-circle",
      sortOrder: 5,
    },
    [RotationRowStatus.ManualRotation]: {
      status: RotationRowStatus.ManualRotation,
      labelKey: "pamRotationConfigStatusManualRotation",
      variant: "subtle",
      icon: "bwi-user",
      sortOrder: 6,
    },
    [RotationRowStatus.Active]: {
      status: RotationRowStatus.Active,
      labelKey: "active",
      variant: "success",
      icon: "bwi-check-circle",
      sortOrder: 7,
    },
  } as const);

/**
 * Every status the status filter offers, in urgency order. Failed is withheld because the list
 * view carries no last-job outcome to derive it from.
 */
export const ROTATION_STATUS_BADGES = Object.freeze(
  Object.values(STATUS_BADGES)
    .filter((badge) => badge.status !== RotationRowStatus.Failed)
    .sort((a, b) => a.sortOrder - b.sortOrder),
);

/**
 * Resolves the one status a row shows, first match winning: Rotating, Paused, Not connected,
 * Rotation due, Manual rotation, Active. `hasConnectedConnector` is `null` when connectivity is
 * unknown, which never reads as Not connected.
 */
export function resolveRotationStatus(
  config: Pick<
    RotationConfigView,
    "enabled" | "hasActiveJob" | "awaitingManualRotation" | "targetSystemMethod"
  >,
  hasConnectedConnector: boolean | null = null,
): RotationRowStatus {
  if (config.hasActiveJob) {
    return RotationRowStatus.Rotating;
  }
  if (!config.enabled) {
    return RotationRowStatus.Paused;
  }
  if (
    config.targetSystemMethod === TargetSystemMethod.Automatic &&
    hasConnectedConnector === false
  ) {
    return RotationRowStatus.NotConnected;
  }
  if (config.targetSystemMethod === TargetSystemMethod.Manual) {
    return config.awaitingManualRotation
      ? RotationRowStatus.RotationDue
      : RotationRowStatus.ManualRotation;
  }
  return RotationRowStatus.Active;
}

export function rotationStatusBadge(status: RotationRowStatus): RotationStatusBadge {
  return STATUS_BADGES[status];
}

/**
 * Whether a target system has an enabled, connected access connector assigned. A disabled
 * connector can't claim jobs, so it doesn't count. `null` connectors means the read failed.
 */
export function hasConnectedConnector(
  connectors: readonly AccessConnector[] | null,
  targetSystemId: TargetSystemId,
): boolean | null {
  if (connectors == null) {
    return null;
  }
  return connectors.some(
    (c) =>
      c.status === AccessConnectorStatus.Enabled &&
      c.isConnected &&
      c.assignedTargetSystemIds.includes(targetSystemId),
  );
}

/** What the Next rotation column shows, before it is turned into text. */
export type NextRotation = { kind: "in-progress" } | { kind: "none" } | { kind: "at"; ms: number };

/**
 * A managed credential row. Every sortable column maps to a field, and dates carry epoch ms for
 * sorting beside the ISO string for display.
 */
export type RotationConfigRow = {
  id: RotationConfigId;
  config: RotationConfigView;
  /** The decrypted cipher name, or the cipher id until the vault read resolves it. */
  cipherName: string;
  targetSystemName: string;
  methodLabelKey: string;
  status: RotationRowStatus;
  statusBadge: RotationStatusBadge;
  statusLabelKey: string;
  /** The Status column's sort key. */
  statusSortOrder: number;
  /** `null` when the sealed fields failed verification. */
  accountIdentity: string | null;
  /** Whether the status is Not connected, which also disables Rotate now. */
  notConnected: boolean;
  nextRotation: NextRotation;
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
  config: RotationConfigView,
  targetSystem: TargetSystemView | undefined,
  cipherName: string | undefined,
  description: RotationConfigDescription,
  connectors: readonly AccessConnector[] | null = null,
): RotationConfigRow {
  const scheduleLabelKeyOrCron = scheduleLabel(
    description.schedulePreset,
    config.scheduleCron ?? null,
  );

  const status = resolveRotationStatus(
    config,
    hasConnectedConnector(connectors, config.targetSystemId),
  );
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
    accountIdentity: config.sealed?.accountIdentity ?? null,
    notConnected: status === RotationRowStatus.NotConnected,
    nextRotation: nextRotation(status, nextRotationAtMs),
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

function nextRotation(status: RotationRowStatus, ms: number | null): NextRotation {
  if (status === RotationRowStatus.Rotating) {
    return { kind: "in-progress" };
  }
  if (status === RotationRowStatus.Paused || ms == null || Number.isNaN(ms)) {
    return { kind: "none" };
  }
  return { kind: "at", ms };
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
