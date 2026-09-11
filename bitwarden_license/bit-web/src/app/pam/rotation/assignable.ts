import { AccessConnector, AccessConnectorStatus, TargetSystem, TargetSystemId } from "./rotation";

/**
 * The access connectors a target system can still be given: the active ones it does not already
 * hold.
 */
export function assignableConnectors(
  targetSystemId: TargetSystemId,
  connectors: readonly AccessConnector[],
): AccessConnector[] {
  return eligibleConnectors(connectors).filter(
    (connector) => !connector.assignedTargetSystemIds.includes(targetSystemId),
  );
}

/**
 * The access connectors that can be assigned to any target system at all, before any particular
 * target's own assignments are taken off.
 *
 * {@link assignableConnectors} is this set minus one target's existing assignments, so an empty
 * result here is the stronger statement: the org has no connector to give.
 */
export function eligibleConnectors(connectors: readonly AccessConnector[]): AccessConnector[] {
  return [...connectors];
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
