import { AccessConnectorStatus } from "../rotation";

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
