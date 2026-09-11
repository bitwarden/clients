import type { OrganizationId } from "@bitwarden/common/types/guid";

import type {
  AccessConnectorDetail,
  AccessConnectorId,
  AccessConnectorRegistrationResponse,
  AccessConnector,
  RotationConfigActions,
  RotationConfigCreateRequest,
  RotationConfigDetail,
  RotationConfigId,
  RotationConfigUpdateRequest,
  RotationConfig,
  TargetSystemCreateRequest,
  TargetSystemId,
  TargetSystemUpdateRequest,
  TargetSystem,
} from "./rotation";
import { QuartzSchedulePreset, TargetSystemStatus } from "./rotation";

/**
 * The Admin Console's credential-rotation surface, backed by the Rust SDK's
 * `commercial().pam().rotation()` client, so components inject a contract rather than the SDK.
 *
 * Rotation mutations don't feed the leasing refresh streams — that path is for lease and cipher
 * access state. Errors surface as-is, in the SDK's flat `RotationError` shape.
 */
/** The SDK-derived half of a rendered config row. See {@link RotationSdkService.describeConfigs}. */
export type RotationConfigDescription = {
  /** Which actions the config currently offers. */
  actions: RotationConfigActions;
  /** The named schedule its cron matches, or `Custom` for an operator-authored expression. */
  schedulePreset: QuartzSchedulePreset;
};

export abstract class RotationSdkService {
  /** Lists the organization's access connectors. */
  abstract listConnectors(organizationId: OrganizationId): Promise<AccessConnector[]>;

  /** Reads one connector with its recent rotation activity. */
  abstract getConnector(
    organizationId: OrganizationId,
    id: AccessConnectorId,
  ): Promise<AccessConnectorDetail>;

  /**
   * Registers a connector and returns its one-time token.
   *
   * The server keeps only a hash of the client secret, so the token is unrecoverable; show it
   * for the operator to copy and never persist or log it.
   */
  abstract registerConnector(
    organizationId: OrganizationId,
    name: string,
  ): Promise<AccessConnectorRegistrationResponse>;

  /** Re-enables a disabled connector so it can claim jobs again. */
  abstract enableConnector(organizationId: OrganizationId, id: AccessConnectorId): Promise<void>;

  /** Stops a connector claiming new jobs and releases its running ones. Reversible. */
  abstract disableConnector(organizationId: OrganizationId, id: AccessConnectorId): Promise<void>;

  /**
   * Permanently deletes a connector and invalidates its credential.
   *
   * The connector held the plaintext organization key; rotating the organization key, not this,
   * is the remediation for suspected compromise.
   */
  abstract deleteConnector(organizationId: OrganizationId, id: AccessConnectorId): Promise<void>;

  /** Assigns a target system to a connector. */
  abstract assignTarget(
    organizationId: OrganizationId,
    id: AccessConnectorId,
    targetSystemId: TargetSystemId,
  ): Promise<void>;

  /** Removes a target-system assignment from a connector. */
  abstract unassignTarget(
    organizationId: OrganizationId,
    id: AccessConnectorId,
    targetSystemId: TargetSystemId,
  ): Promise<void>;

  /** Lists the organization's target systems. */
  abstract listTargetSystems(organizationId: OrganizationId): Promise<TargetSystem[]>;

  /** Creates a target system. */
  abstract createTargetSystem(
    organizationId: OrganizationId,
    request: TargetSystemCreateRequest,
  ): Promise<TargetSystem>;

  /**
   * Updates a target system's name, password policy, and session-termination capability in one
   * write — the server takes them together, so a caller changing one still sends the others.
   *
   * Resolves to nothing: the server answers with no content, so a caller that renders the result
   * must re-read through {@link listTargetSystems}.
   */
  abstract updateTargetSystem(
    organizationId: OrganizationId,
    id: TargetSystemId,
    request: TargetSystemUpdateRequest,
  ): Promise<void>;

  /** Puts a disabled target system back into service. */
  abstract enableTargetSystem(organizationId: OrganizationId, id: TargetSystemId): Promise<void>;

  /** Stops new rotation jobs being dispatched for a target system. In-flight jobs finish. */
  abstract disableTargetSystem(organizationId: OrganizationId, id: TargetSystemId): Promise<void>;

  /**
   * Permanently deletes a target system.
   *
   * The server refuses this while any rotation config still names the target; deleting those
   * first also releases each cipher, and connector assignments go with it.
   *
   * Narrower than {@link disableTargetSystem}: disable is for a merely unavailable target,
   * delete is for one that has left the estate.
   */
  abstract deleteTargetSystem(organizationId: OrganizationId, id: TargetSystemId): Promise<void>;

  // Managed credentials (rotation configs) ————————————————————————————————————

  /** Lists the organization's rotation configs. */
  abstract listConfigs(organizationId: OrganizationId): Promise<RotationConfig[]>;

  /** Reads one config with its rotation history. */
  abstract getConfig(
    organizationId: OrganizationId,
    id: RotationConfigId,
  ): Promise<RotationConfigDetail>;

  /** Creates a rotation config. */
  abstract createConfig(
    organizationId: OrganizationId,
    request: RotationConfigCreateRequest,
  ): Promise<RotationConfigDetail>;

  /**
   * Updates a config's account identity and schedule in one write — again, the server takes them
   * together.
   *
   * The server locks the account identity while a job is in flight; check
   * {@link RotationConfigActions.mutationsLocked} before offering the edit.
   */
  abstract updateConfig(
    organizationId: OrganizationId,
    id: RotationConfigId,
    request: RotationConfigUpdateRequest,
  ): Promise<RotationConfigDetail>;

  /** Pauses a config, so no new rotation jobs are dispatched. */
  abstract pauseConfig(organizationId: OrganizationId, id: RotationConfigId): Promise<void>;

  /** Resumes a paused config. */
  abstract resumeConfig(organizationId: OrganizationId, id: RotationConfigId): Promise<void>;

  /** Dispatches an on-demand rotation, subject to the server's per-config cooldown. */
  abstract rotateNow(organizationId: OrganizationId, id: RotationConfigId): Promise<void>;

  /** Records that an operator rotated a manual-target config's credential out of band. */
  abstract recordManualRotation(
    organizationId: OrganizationId,
    id: RotationConfigId,
  ): Promise<void>;

  /** Deletes a rotation config. The cipher and target system are untouched. */
  abstract deleteConfig(organizationId: OrganizationId, id: RotationConfigId): Promise<void>;

  // Derived logic ————————————————————————————————————————————————————————————

  /**
   * Everything a rendered config row needs that the SDK derives: which actions it offers, and
   * which named schedule its cron matches.
   *
   * Batched over the whole list, not exposed per config, since reaching the SDK takes a client
   * and fifty configs shouldn't take fifty calls.
   *
   * A target system missing from `targetStatusById` hasn't loaded yet; predicates depending on
   * its status fail closed.
   */
  abstract describeConfigs(
    configs: readonly RotationConfig[],
    targetStatusById: ReadonlyMap<TargetSystemId, TargetSystemStatus>,
  ): Promise<Map<RotationConfigId, RotationConfigDescription>>;

  /** The preset that describes a stored cron expression; `None` for no schedule. */
  abstract presetForCron(cron: string | null): Promise<QuartzSchedulePreset>;

  /** The cron expression for a preset, or `null` for `None` and `Custom`. */
  abstract cronForPreset(preset: QuartzSchedulePreset): Promise<string | null>;

  /** Whether a string is shaped like a Quartz cron expression. Advisory; the server decides. */
  abstract isLikelyQuartzCron(value: string): Promise<boolean>;
}
