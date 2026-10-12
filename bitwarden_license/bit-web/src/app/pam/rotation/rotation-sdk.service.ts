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
  RotationConfig,
  TargetSystemCreateRequest,
  TargetSystemId,
  TargetSystem,
} from "./rotation";
import { QuartzSchedulePreset, TargetSystemStatus } from "./rotation";

/** The SDK-derived half of a config row. See {@link RotationSdkService.describeConfigs}. */
export type RotationConfigDescription = {
  actions: RotationConfigActions;
  /** The named schedule its cron matches, or `Custom` for an operator-authored expression. */
  schedulePreset: QuartzSchedulePreset;
};

/**
 * The Admin Console's credential-rotation surface over the SDK's `commercial().pam().rotation()`
 * client. Mutations don't feed the leasing refresh streams, and errors surface as the SDK's flat
 * `RotationError`.
 */
export abstract class RotationSdkService {
  abstract listConnectors(organizationId: OrganizationId): Promise<AccessConnector[]>;

  /** Reads one connector with its recent rotation activity. */
  abstract getConnector(
    organizationId: OrganizationId,
    id: AccessConnectorId,
  ): Promise<AccessConnectorDetail>;

  /**
   * Returns the connector's one-time token. The server keeps only a hash of the client secret, so
   * the token is unrecoverable; show it once and never persist or log it.
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
   * Permanently deletes a connector and invalidates its credential. It held the organization key
   * in plaintext, so suspected compromise calls for rotating that key instead.
   */
  abstract deleteConnector(organizationId: OrganizationId, id: AccessConnectorId): Promise<void>;

  abstract assignTarget(
    organizationId: OrganizationId,
    id: AccessConnectorId,
    targetSystemId: TargetSystemId,
  ): Promise<void>;

  abstract unassignTarget(
    organizationId: OrganizationId,
    id: AccessConnectorId,
    targetSystemId: TargetSystemId,
  ): Promise<void>;

  abstract listTargetSystems(organizationId: OrganizationId): Promise<TargetSystem[]>;

  /**
   * Registers and seals a target system in two calls; a failure after the first leaves the row in
   * `pending_seal`, with the error carrying its id (`targetSystemCreatePendingId` in `./rotation-error`).
   */
  abstract createTargetSystem(
    organizationId: OrganizationId,
    request: TargetSystemCreateRequest,
  ): Promise<TargetSystem>;

  /**
   * Re-seals and replaces the blob wholesale — every sealed field must be resupplied, including
   * the immutable `method`/`kind` (read from a prior {@link listTargetSystems}; the server rejects
   * a mismatch). Also the only way to finish a `pending_seal` target. No content in response.
   */
  abstract updateTargetSystem(
    organizationId: OrganizationId,
    id: TargetSystemId,
    request: TargetSystemCreateRequest,
  ): Promise<void>;

  abstract enableTargetSystem(organizationId: OrganizationId, id: TargetSystemId): Promise<void>;

  /** Stops dispatching new rotation jobs for a target system; in-flight jobs finish. */
  abstract disableTargetSystem(organizationId: OrganizationId, id: TargetSystemId): Promise<void>;

  /**
   * Permanently deletes a target system and its connector assignments. The server refuses while
   * any rotation config still names the target.
   */
  abstract deleteTargetSystem(organizationId: OrganizationId, id: TargetSystemId): Promise<void>;

  abstract listConfigs(organizationId: OrganizationId): Promise<RotationConfig[]>;

  /** Reads one config with its rotation history. */
  abstract getConfig(
    organizationId: OrganizationId,
    id: RotationConfigId,
  ): Promise<RotationConfigDetail>;

  abstract createConfig(
    organizationId: OrganizationId,
    request: RotationConfigCreateRequest,
  ): Promise<RotationConfigDetail>;

  /**
   * Re-seals and replaces the blob wholesale — `cipherId`/`targetSystemId` must be resupplied
   * unchanged (read from a prior {@link getConfig}; the server rejects a mismatch). Locks the
   * account identity while a job runs; check {@link RotationConfigActions.mutationsLocked} first.
   */
  abstract updateConfig(
    organizationId: OrganizationId,
    id: RotationConfigId,
    request: RotationConfigCreateRequest,
  ): Promise<RotationConfigDetail>;

  /** Pauses a config, so no new rotation jobs are dispatched. */
  abstract pauseConfig(organizationId: OrganizationId, id: RotationConfigId): Promise<void>;

  abstract resumeConfig(organizationId: OrganizationId, id: RotationConfigId): Promise<void>;

  /** Dispatches an on-demand rotation, subject to the server's per-config cooldown. */
  abstract rotateNow(organizationId: OrganizationId, id: RotationConfigId): Promise<void>;

  /** Records that an operator rotated a manual-target config's credential out of band. */
  abstract recordManualRotation(
    organizationId: OrganizationId,
    id: RotationConfigId,
  ): Promise<void>;

  /** The cipher and target system are untouched. */
  abstract deleteConfig(organizationId: OrganizationId, id: RotationConfigId): Promise<void>;

  /**
   * Batched over the whole list, since each SDK call takes a client. A target system missing from
   * `targetStatusById` hasn't loaded yet; predicates that depend on its status fail closed.
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
