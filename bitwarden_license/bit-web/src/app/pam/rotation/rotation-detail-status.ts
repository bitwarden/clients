import {
  RotationRowStatus,
  RotationStatusBadge,
  rotationStatusBadge,
} from "./managed-credentials/rotation-config-row";
import {
  AccessConnector,
  AccessConnectorStatus,
  RotationAttemptStatus,
  RotationConfigView,
  RotationJob,
  RotationJobStatus,
  TargetSystemId,
  TargetSystemMethod,
} from "./rotation";

/** How a target system's access connectors stand, `unknown` when the read failed. */
export type ConnectorState = "connected" | "none-assigned" | "all-disconnected" | "unknown";

export function connectorStateFor(
  connectors: readonly AccessConnector[] | null,
  targetSystemId: TargetSystemId,
): ConnectorState {
  if (connectors == null) {
    return "unknown";
  }
  const assigned = assignedConnectors(connectors, targetSystemId);
  if (assigned.length === 0) {
    return "none-assigned";
  }
  return assigned.some(isConnected) ? "connected" : "all-disconnected";
}

export function assignedConnectors(
  connectors: readonly AccessConnector[],
  targetSystemId: TargetSystemId,
): AccessConnector[] {
  return connectors.filter((c) => c.assignedTargetSystemIds.includes(targetSystemId));
}

export function isConnected(connector: AccessConnector): boolean {
  return connector.status === AccessConnectorStatus.Enabled && connector.isConnected;
}

export type DetailCallout =
  | { kind: "paused" }
  | { kind: "retrying" }
  | { kind: "no-connector" }
  | { kind: "disconnected" }
  | { kind: "timed-out" }
  | { kind: "due" };

export type DetailStatus = {
  status: RotationRowStatus;
  badge: RotationStatusBadge;
  callout: DetailCallout | null;
};

function isFailedJob(job: RotationJob): boolean {
  return job.status === RotationJobStatus.Failed || job.status === RotationJobStatus.TimedOut;
}

function latestJob(jobs: readonly RotationJob[]): RotationJob | undefined {
  return [...jobs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

function activeJob(jobs: readonly RotationJob[]): RotationJob | undefined {
  return latestJob(
    jobs.filter(
      (j) => j.status === RotationJobStatus.Pending || j.status === RotationJobStatus.Claimed,
    ),
  );
}

/**
 * The status the detail page shows, first match winning: Rotating, Paused, Not connected, Failed,
 * Rotation due, Active. Unlike the list's `resolveRotationStatus`, it reads the job history.
 */
export function resolveDetailStatus(
  config: Pick<
    RotationConfigView,
    "enabled" | "hasActiveJob" | "awaitingManualRotation" | "targetSystemMethod"
  >,
  jobs: readonly RotationJob[],
  connectorState: ConnectorState,
): DetailStatus {
  const result = (status: RotationRowStatus, callout: DetailCallout | null): DetailStatus => ({
    status,
    badge: rotationStatusBadge(status),
    callout,
  });

  if (config.hasActiveJob) {
    const retrying = activeJob(jobs)?.attempts?.some(
      (a) =>
        a.status === RotationAttemptStatus.Errored || a.status === RotationAttemptStatus.Abandoned,
    );
    return result(RotationRowStatus.Rotating, retrying ? { kind: "retrying" } : null);
  }
  if (!config.enabled) {
    return result(RotationRowStatus.Paused, { kind: "paused" });
  }
  if (
    config.targetSystemMethod === TargetSystemMethod.Automatic &&
    (connectorState === "none-assigned" || connectorState === "all-disconnected")
  ) {
    return result(
      RotationRowStatus.NotConnected,
      connectorState === "none-assigned" ? { kind: "no-connector" } : { kind: "disconnected" },
    );
  }
  const latest = latestJob(jobs);
  if (latest != null && isFailedJob(latest)) {
    return result(
      RotationRowStatus.Failed,
      latest.status === RotationJobStatus.TimedOut ? { kind: "timed-out" } : null,
    );
  }
  if (config.awaitingManualRotation) {
    return result(RotationRowStatus.RotationDue, { kind: "due" });
  }
  return result(RotationRowStatus.Active, null);
}
