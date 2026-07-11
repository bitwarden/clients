import { RotationConfigResponse } from "../abstractions/responses/rotation-config.response";
import { TargetSystemMethod, TargetSystemStatus } from "../abstractions/rotation";

/**
 * Whether a "Rotate now" action can be offered for a config.
 *
 * Mirrors Allium spec rule `can_offer`:
 *   enabled && method == Automatic && target status == Active && !hasActiveJob
 *
 * `targetStatus` is undefined when the config's target system is not yet
 * loaded (e.g. the target-systems list is still fetching) — treat as false.
 */
export function canRotateNow(
  config: Pick<RotationConfigResponse, "enabled" | "targetSystemMethod" | "hasActiveJob">,
  targetStatus: TargetSystemStatus | undefined,
): boolean {
  return (
    config.enabled &&
    config.targetSystemMethod === TargetSystemMethod.Automatic &&
    targetStatus === TargetSystemStatus.Active &&
    !config.hasActiveJob
  );
}

/**
 * Whether the "Record manual rotation" action should be offered.
 *
 * Only meaningful (and shown) for Manual target-system method configs.
 */
export function canRecordManual(
  config: Pick<RotationConfigResponse, "targetSystemMethod">,
): boolean {
  return config.targetSystemMethod === TargetSystemMethod.Manual;
}

/**
 * Whether mutation actions are locked for a config.
 *
 * Guards UpdateRotationAccount and DeleteRotationConfig. When a job is
 * running, the account identity and delete are disabled with a tooltip
 * "wait or pause first".
 */
export function mutationsLocked(config: Pick<RotationConfigResponse, "hasActiveJob">): boolean {
  return config.hasActiveJob;
}

/**
 * Whether the "Pause" action can be offered.
 *
 * Only enabled configs can be paused.
 */
export function canPause(config: Pick<RotationConfigResponse, "enabled">): boolean {
  return config.enabled;
}

/**
 * Whether the "Resume" action can be offered.
 *
 * Only disabled (paused) configs can be resumed.
 */
export function canResume(config: Pick<RotationConfigResponse, "enabled">): boolean {
  return !config.enabled;
}
