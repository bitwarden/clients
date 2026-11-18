import type { BadgeVariant, BitwardenIcon, IconTileVariant } from "@bitwarden/components";

import { AccessConnector, AccessConnectorStatus } from "../rotation";

/** How an access connector's two states are named and badged, wherever one is shown. */
export function accessConnectorStatusLabelKey(
  status: AccessConnectorStatus,
): "active" | "inactive" {
  return status === AccessConnectorStatus.Enabled ? "active" : "inactive";
}

export function accessConnectorConnectionLabelKey(
  isConnected: boolean,
): "pamAccessConnectorConnected" | "pamAccessConnectorDisconnected" {
  return isConnected ? "pamAccessConnectorConnected" : "pamAccessConnectorDisconnected";
}

/** The one status an access connector shows. See {@link accessConnectorDisplayStatus}. */
export const AccessConnectorDisplayStatus = Object.freeze({
  Disconnected: "disconnected",
  Inactive: "inactive",
  Connected: "connected",
} as const);
export type AccessConnectorDisplayStatus =
  (typeof AccessConnectorDisplayStatus)[keyof typeof AccessConnectorDisplayStatus];

/** How a status renders as a badge, and as a filter option's icon tile. */
export type AccessConnectorStatusBadge = {
  readonly status: AccessConnectorDisplayStatus;
  readonly labelKey: string;
  readonly variant: BadgeVariant;
  readonly icon: BitwardenIcon;
  readonly tileVariant: IconTileVariant;
  /** Ascending position by urgency, which differs from the precedence that picks the status. */
  readonly sortOrder: number;
};

const STATUS_BADGES: Readonly<
  Record<AccessConnectorDisplayStatus, Readonly<AccessConnectorStatusBadge>>
> = Object.freeze({
  [AccessConnectorDisplayStatus.Disconnected]: {
    status: AccessConnectorDisplayStatus.Disconnected,
    labelKey: "pamAccessConnectorDisconnected",
    variant: "warning",
    icon: "bwi-warning",
    tileVariant: "warning",
    sortOrder: 1,
  },
  [AccessConnectorDisplayStatus.Inactive]: {
    status: AccessConnectorDisplayStatus.Inactive,
    labelKey: "inactive",
    variant: "subtle",
    icon: "bwi-minus-circle",
    tileVariant: "gray",
    sortOrder: 2,
  },
  [AccessConnectorDisplayStatus.Connected]: {
    status: AccessConnectorDisplayStatus.Connected,
    labelKey: "pamAccessConnectorConnected",
    variant: "success",
    icon: "bwi-check-circle",
    tileVariant: "success",
    sortOrder: 3,
  },
} as const);

/** Every status, in urgency order, as the status filter offers them. */
export const ACCESS_CONNECTOR_STATUS_BADGES: readonly AccessConnectorStatusBadge[] = Object.freeze(
  Object.values(STATUS_BADGES).sort((a, b) => a.sortOrder - b.sortOrder),
);

/**
 * The first true of Inactive, Disconnected, Connected. An inactive connector may still be
 * connected, but it takes no rotations, so Inactive wins.
 */
export function accessConnectorDisplayStatus(
  connector: Pick<AccessConnector, "status" | "isConnected">,
): AccessConnectorDisplayStatus {
  if (connector.status !== AccessConnectorStatus.Enabled) {
    return AccessConnectorDisplayStatus.Inactive;
  }
  return connector.isConnected
    ? AccessConnectorDisplayStatus.Connected
    : AccessConnectorDisplayStatus.Disconnected;
}

export function accessConnectorStatusBadge(
  status: AccessConnectorDisplayStatus,
): AccessConnectorStatusBadge {
  return STATUS_BADGES[status];
}
