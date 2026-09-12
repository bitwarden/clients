import { AccessConnector, AccessConnectorStatus, TargetSystem, TargetSystemId } from "./rotation";

/**
 * The access connectors a target system can still be given: the active ones it does not already
 * hold.
 */
export function assignableConnectors(
  targetSystemId: TargetSystemId,
  connectors: readonly AccessConnector[],
): AccessConnector[] {
  return connectors.filter(
    (connector) =>
      connector.status === AccessConnectorStatus.Enabled &&
      !connector.assignedTargetSystemIds.includes(targetSystemId),
  );
}

/**
 * The mirror of {@link assignableConnectors}, read by the same two callers on the other tab: the
 * target systems a connector does not already hold.
 */
export function assignableTargetSystems(
  assignedTargetSystemIds: readonly TargetSystemId[],
  eligible: readonly TargetSystem[],
): TargetSystem[] {
  const assigned = new Set<TargetSystemId>(assignedTargetSystemIds);
  return eligible.filter((system) => !assigned.has(system.id));
}
