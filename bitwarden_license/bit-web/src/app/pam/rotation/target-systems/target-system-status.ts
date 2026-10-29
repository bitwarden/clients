import type { BadgeVariant, BitwardenIcon } from "@bitwarden/components";

import { hasConnectedConnector } from "../managed-credentials/rotation-config-row";
import {
  AccessConnector,
  TargetSystemMethod,
  TargetSystemStatus,
  TargetSystemView,
} from "../rotation";

/**
 * The one status a target system shows, on the table, the filter and the edit page header. Setup
 * incomplete is the SDK's own state for a target whose sealed fields are not confirmed yet, which
 * the design does not draw, so it sits ahead of the three the design names.
 */
export const TargetSystemRowStatus = Object.freeze({
  PendingSeal: "pending-seal",
  NotConnected: "not-connected",
  Inactive: "inactive",
  Active: "active",
} as const);
export type TargetSystemRowStatus =
  (typeof TargetSystemRowStatus)[keyof typeof TargetSystemRowStatus];

/** How a resolved status renders: one label, one colour, one icon. */
export type TargetSystemStatusBadge = {
  status: TargetSystemRowStatus;
  labelKey: string;
  variant: BadgeVariant;
  icon: BitwardenIcon;
  /**
   * Ascending sort position by urgency, which differs from the precedence in
   * {@link resolveTargetSystemStatus}. Sorting on the label would order by spelling, differently
   * in every locale.
   */
  sortOrder: number;
};

const STATUS_BADGES: Readonly<Record<TargetSystemRowStatus, Readonly<TargetSystemStatusBadge>>> =
  Object.freeze({
    [TargetSystemRowStatus.PendingSeal]: {
      status: TargetSystemRowStatus.PendingSeal,
      labelKey: "pamTargetSystemStatusPendingSeal",
      variant: "warning",
      icon: "bwi-warning",
      sortOrder: 0,
    },
    [TargetSystemRowStatus.NotConnected]: {
      status: TargetSystemRowStatus.NotConnected,
      labelKey: "pamTargetSystemStatusNotConnected",
      variant: "warning",
      icon: "bwi-warning",
      sortOrder: 1,
    },
    [TargetSystemRowStatus.Inactive]: {
      status: TargetSystemRowStatus.Inactive,
      labelKey: "pamTargetSystemStatusInactive",
      variant: "subtle",
      icon: "bwi-minus-circle",
      sortOrder: 2,
    },
    [TargetSystemRowStatus.Active]: {
      status: TargetSystemRowStatus.Active,
      labelKey: "pamTargetSystemStatusActive",
      variant: "success",
      icon: "bwi-check-circle",
      sortOrder: 3,
    },
  } as const);

/** Every status, in urgency order. */
export const TARGET_SYSTEM_STATUS_BADGES: readonly Readonly<TargetSystemStatusBadge>[] =
  Object.freeze(Object.values(STATUS_BADGES).sort((a, b) => a.sortOrder - b.sortOrder));

/**
 * Resolves the one status a target system shows. Setup incomplete wins, then Inactive, then Not
 * connected (an automatic target with no enabled, connected access connector assigned), then
 * Active. A manual target has nothing to connect, so it is never Not connected. `connectors` is
 * `null` when the list is unread or failed to load, which never reads as Not connected.
 */
export function resolveTargetSystemStatus(
  system: Pick<TargetSystemView, "id" | "status" | "method">,
  connectors: readonly AccessConnector[] | null,
): TargetSystemRowStatus {
  if (system.status === TargetSystemStatus.PendingSeal) {
    return TargetSystemRowStatus.PendingSeal;
  }
  if (system.status !== TargetSystemStatus.Active) {
    return TargetSystemRowStatus.Inactive;
  }
  if (
    system.method === TargetSystemMethod.Automatic &&
    hasConnectedConnector(connectors, system.id) === false
  ) {
    return TargetSystemRowStatus.NotConnected;
  }
  return TargetSystemRowStatus.Active;
}

export function targetSystemStatusBadge(status: TargetSystemRowStatus): TargetSystemStatusBadge {
  return STATUS_BADGES[status];
}
