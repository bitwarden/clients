import type { OrganizationId } from "@bitwarden/common/types/guid";

import type { AccessConnectorDetailView, AccessConnectorId, AccessConnectorRegistrationView, AccessConnectorView, RotationConfigActions, RotationConfigCreateRequest, RotationConfigDetailView, RotationConfigId, RotationConfigUpdateRequest, RotationConfigView, TargetSystemCreateRequest, TargetSystemId, TargetSystemUpdateRequest, TargetSystemView } from "./rotation";
import { QuartzSchedulePreset, TargetSystemStatus } from "./rotation";

/**
 * The Admin Console's credential-rotation surface.
 *
 * Backed by the Rust SDK's `commercial().pam().rotation()` client — the domain, the wire mapping,
 * the request validation and the registration crypto all live there. This abstraction exists only
 * so components and page services inject a contract rather than the SDK, which keeps them testable
 * without a WASM client.
 *
 * Rotation mutations deliberately do not feed the leasing refresh streams
 * (`AccessRefreshService`) — that path is for lease and cipher access state. The page-scoped
 * services (`RotationConfigsService`, `TargetSystemsService`, `DaemonsService`) own their own
 * refresh cycles.
 *
 * Errors surface as-is, in the SDK's flat `RotationError` shape, for callers to interpret.
 */
/** The SDK-derived half of a rendered config row. See {@link RotationSdkService.describeConfigs}. */
export type RotationConfigDescription = {
  /** Which actions the config currently offers. */
  actions: RotationConfigActions;
  /** The named schedule its cron matches, or `Custom` for an operator-authored expression. */
  schedulePreset: QuartzSchedulePreset;
};

export abstract class RotationSdkService {
  // Access connectors ————————————————————————————————————————————————————————

  /** Lists the organization's access connectors. */
  abstract listConnectors(organizationId: OrganizationId): Promise<AccessConnectorView[]>;

  /** Reads one connector with its recent rotation activity. */
  abstract getConnector(
    organizationId: OrganizationId,
    id: AccessConnectorId,
  ): Promise<AccessConnectorDetailView>;

  /**
   * Registers a connector and returns its one-time token.
   *
   * The SDK derives the key material and assembles the token; the server keeps only a hash of the
   * client secret, so the token is unrecoverable. Show it once for the operator to copy and never
   * persist or log it.
   */
  abstract registerConnector(
    organizationId: OrganizationId,
    name: string,
  ): Promise<AccessConnectorRegistrationView>;

  /** Re-enables a disabled connector so it can claim jobs again. */
  abstract enableConnector(
    organizationId: OrganizationId,
    id: AccessConnectorId,
  ): Promise<void>;

  /** Stops a connector claiming new jobs and releases its running ones. Reversible. */
  abstract disableConnector(
    organizationId: OrganizationId,
    id: AccessConnectorId,
  ): Promise<void>;

  /**
   * Permanently deletes a connector and invalidates its credential.
   *
   * The connector held the plaintext organization key, so if compromise is suspected, rotating the
   * organization key — not this — is the remediation.
   */
  abstract deleteConnector(
    organizationId: OrganizationId,
    id: AccessConnectorId,
  ): Promise<void>;

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

  // Target systems ———————————————————————————————————————————————————————————

  /** Lists the organization's target systems. */
  abstract listTargetSystems(organizationId: OrganizationId): Promise<TargetSystemView[]>;

  /** Creates a target system. */
  abstract createTargetSystem(
    organizationId: OrganizationId,
    request: TargetSystemCreateRequest,
  ): Promise<TargetSystemView>;

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

  /** Returns a disabled target system to service. */
  abstract enableTargetSystem(
    organizationId: OrganizationId,
    id: TargetSystemId,
  ): Promise<void>;

  /** Stops new rotation jobs being dispatched for a target system. In-flight jobs finish. */
  abstract disableTargetSystem(
    organizationId: OrganizationId,
    id: TargetSystemId,
  ): Promise<void>;

  // Managed credentials (rotation configs) ————————————————————————————————————

  /** Lists the organization's rotation configs. */
  abstract listConfigs(organizationId: OrganizationId): Promise<RotationConfigView[]>;

  /** Reads one config with its rotation history. */
  abstract getConfig(
    organizationId: OrganizationId,
    id: RotationConfigId,
  ): Promise<RotationConfigDetailView>;

  /** Creates a rotation config. */
  abstract createConfig(
    organizationId: OrganizationId,
    request: RotationConfigCreateRequest,
  ): Promise<RotationConfigDetailView>;

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
  ): Promise<RotationConfigDetailView>;

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
   * Batched over the whole list rather than exposed per config because reaching the SDK means
   * taking a client, and a list of fifty configs should not take fifty. The predicates themselves
   * are synchronous once the client is in hand.
   *
   * A target system missing from `targetStatusById` has not loaded yet; every predicate that
   * depends on its status then fails closed, so a config never offers a rotation the server would
   * refuse.
   */
  abstract describeConfigs(
    configs: readonly RotationConfigView[],
    targetStatusById: ReadonlyMap<TargetSystemId, TargetSystemStatus>,
  ): Promise<Map<RotationConfigId, RotationConfigDescription>>;

  /** The preset that describes a stored cron expression, or `None` when there is no schedule. */
  abstract presetForCron(cron: string | null): Promise<QuartzSchedulePreset>;

  /** The cron expression for a preset, or `null` for `None` and `Custom`. */
  abstract cronForPreset(preset: QuartzSchedulePreset): Promise<string | null>;

  /** Whether a string is shaped like a Quartz cron expression. Advisory; the server decides. */
  abstract isLikelyQuartzCron(value: string): Promise<boolean>;
}
