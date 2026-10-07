import { AccessConnector, AccessConnectorStatus, TargetSystem, TargetSystemId } from "./rotation";

/** The enabled access connectors a target system does not already hold. */
export function assignableConnectors(
  targetSystemId: TargetSystemId,
  connectors: readonly AccessConnector[],
): AccessConnector[] {
  return eligibleConnectors(connectors).filter(
    (connector) => !connector.assignedTargetSystemIds.includes(targetSystemId),
  );
}

/**
 * The access connectors any target system could be given. Empty here means the org has no
 * connector to give, a stronger statement than an empty {@link assignableConnectors}.
 */
export function eligibleConnectors(connectors: readonly AccessConnector[]): AccessConnector[] {
  return connectors.filter((connector) => connector.status === AccessConnectorStatus.Enabled);
}

/** The target systems a connector does not hold, the mirror of {@link assignableConnectors}. */
export function assignableTargetSystems(
  assignedTargetSystemIds: readonly TargetSystemId[],
  eligible: readonly TargetSystem[],
): TargetSystem[] {
  const assigned = new Set<TargetSystemId>(assignedTargetSystemIds);
  return eligible.filter((system) => !assigned.has(system.id));
}
