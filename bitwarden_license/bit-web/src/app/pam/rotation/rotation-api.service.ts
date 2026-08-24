import type { ListResponse } from "@bitwarden/common/models/response/list.response";
import type { OrganizationId } from "@bitwarden/common/types/guid";

import type { DaemonAssignmentRequest } from "./requests/daemon-assignment.request";
import type { DaemonRegisterRequest } from "./requests/daemon-register.request";
import type { RotationConfigAccountRequest } from "./requests/rotation-config-account.request";
import type { RotationConfigCreateRequest } from "./requests/rotation-config-create.request";
import type { RotationConfigSettingsRequest } from "./requests/rotation-config-settings.request";
import type { TargetSystemCreateRequest } from "./requests/target-system-create.request";
import type { TargetSystemNameRequest } from "./requests/target-system-name.request";
import type { TargetSystemPolicyRequest } from "./requests/target-system-policy.request";
import type { DaemonRegistrationResponse } from "./responses/daemon-registration.response";
import type { RotationConfigDetailsResponse } from "./responses/rotation-config-details.response";
import type { RotationConfigResponse } from "./responses/rotation-config.response";
import type { RotationDaemonDetailsResponse } from "./responses/rotation-daemon-details.response";
import type { RotationDaemonResponse } from "./responses/rotation-daemon.response";
import type { TargetSystemResponse } from "./responses/target-system.response";

/**
 * The Admin Console's credential-rotation surface, as raw HTTP.
 *
 * The second exception to this module's rule that PAM calls go through the Rust SDK, for the same
 * reason as the access-audit trail: the server implements `/organizations/{orgId}/rotation/...`, but
 * the pinned commercial SDK's `pam()` client exposes only `access_requests()`, `access_rules()`,
 * `leases()`, and the approver surface. There is no rotation client, so there is no SDK call to
 * make. Binding this behind an abstraction means the eventual swap is a provider change in
 * `provide-pam.ts` and nothing else. See `../access-audit/audit-api.service.ts`.
 *
 * Closing this exception is SDK work: a `rotation` module on the `bitwarden-pam` crate.
 *
 * Rotation mutations deliberately do not feed the leasing refresh streams
 * (`AccessRefreshService`) — that path is for lease and cipher access state. The page-scoped
 * services (`RotationConfigsService`, `TargetSystemsService`, `DaemonsService`) own their own
 * refresh cycles.
 */
export abstract class RotationApiService {
  // Daemons ——————————————————————————————————————————————————————————————————

  /** `GET /organizations/{orgId}/rotation/daemons` */
  abstract listRotationDaemons(
    organizationId: OrganizationId,
  ): Promise<ListResponse<RotationDaemonResponse>>;

  /** `GET /organizations/{orgId}/rotation/daemons/{daemonId}` */
  abstract getRotationDaemon(
    organizationId: OrganizationId,
    daemonId: string,
  ): Promise<RotationDaemonDetailsResponse>;

  /**
   * `POST /organizations/{orgId}/rotation/daemons`
   *
   * Returns the one-time enrollment token. The server never returns it again, so the caller is
   * responsible for showing it once and not persisting it.
   */
  abstract registerRotationDaemon(
    organizationId: OrganizationId,
    request: DaemonRegisterRequest,
  ): Promise<DaemonRegistrationResponse>;

  /** `POST /organizations/{orgId}/rotation/daemons/{daemonId}/enable` */
  abstract enableRotationDaemon(organizationId: OrganizationId, daemonId: string): Promise<void>;

  /** `POST /organizations/{orgId}/rotation/daemons/{daemonId}/disable` */
  abstract disableRotationDaemon(organizationId: OrganizationId, daemonId: string): Promise<void>;

  /** `DELETE /organizations/{orgId}/rotation/daemons/{daemonId}` */
  abstract deleteRotationDaemon(organizationId: OrganizationId, daemonId: string): Promise<void>;

  /** `POST /organizations/{orgId}/rotation/daemons/{daemonId}/assignments` */
  abstract assignRotationDaemon(
    organizationId: OrganizationId,
    daemonId: string,
    request: DaemonAssignmentRequest,
  ): Promise<void>;

  /** `DELETE /organizations/{orgId}/rotation/daemons/{daemonId}/assignments/{targetSystemId}` */
  abstract unassignRotationDaemon(
    organizationId: OrganizationId,
    daemonId: string,
    targetSystemId: string,
  ): Promise<void>;

  // Target systems ———————————————————————————————————————————————————————————

  /** `GET /organizations/{orgId}/rotation/target-systems` */
  abstract listTargetSystems(
    organizationId: OrganizationId,
  ): Promise<ListResponse<TargetSystemResponse>>;

  /** `POST /organizations/{orgId}/rotation/target-systems` */
  abstract createTargetSystem(
    organizationId: OrganizationId,
    request: TargetSystemCreateRequest,
  ): Promise<TargetSystemResponse>;

  /** `POST /organizations/{orgId}/rotation/target-systems/{targetSystemId}/enable` */
  abstract enableTargetSystem(
    organizationId: OrganizationId,
    targetSystemId: string,
  ): Promise<void>;

  /** `POST /organizations/{orgId}/rotation/target-systems/{targetSystemId}/disable` */
  abstract disableTargetSystem(
    organizationId: OrganizationId,
    targetSystemId: string,
  ): Promise<void>;

  /** `PUT /organizations/{orgId}/rotation/target-systems/{targetSystemId}/name` */
  abstract renameTargetSystem(
    organizationId: OrganizationId,
    targetSystemId: string,
    request: TargetSystemNameRequest,
  ): Promise<TargetSystemResponse>;

  /** `PUT /organizations/{orgId}/rotation/target-systems/{targetSystemId}/policy` */
  abstract updateTargetSystemPolicy(
    organizationId: OrganizationId,
    targetSystemId: string,
    request: TargetSystemPolicyRequest,
  ): Promise<TargetSystemResponse>;

  /** `DELETE /organizations/{orgId}/rotation/target-systems/{targetSystemId}` */
  abstract deleteTargetSystem(
    organizationId: OrganizationId,
    targetSystemId: string,
  ): Promise<void>;

  // Managed credentials (rotation configs) ————————————————————————————————————

  /** `GET /organizations/{orgId}/rotation/configs` */
  abstract listRotationConfigs(
    organizationId: OrganizationId,
  ): Promise<ListResponse<RotationConfigResponse>>;

  /** `POST /organizations/{orgId}/rotation/configs` */
  abstract createRotationConfig(
    organizationId: OrganizationId,
    request: RotationConfigCreateRequest,
  ): Promise<RotationConfigResponse>;

  /** `GET /organizations/{orgId}/rotation/configs/{configId}` */
  abstract getRotationConfig(
    organizationId: OrganizationId,
    configId: string,
  ): Promise<RotationConfigDetailsResponse>;

  /** `PUT /organizations/{orgId}/rotation/configs/{configId}/settings` */
  abstract updateRotationConfigSettings(
    organizationId: OrganizationId,
    configId: string,
    request: RotationConfigSettingsRequest,
  ): Promise<RotationConfigResponse>;

  /** `PUT /organizations/{orgId}/rotation/configs/{configId}/account` */
  abstract updateRotationConfigAccount(
    organizationId: OrganizationId,
    configId: string,
    request: RotationConfigAccountRequest,
  ): Promise<RotationConfigResponse>;

  /** `POST /organizations/{orgId}/rotation/configs/{configId}/pause` */
  abstract pauseRotationConfig(organizationId: OrganizationId, configId: string): Promise<void>;

  /** `POST /organizations/{orgId}/rotation/configs/{configId}/resume` */
  abstract resumeRotationConfig(organizationId: OrganizationId, configId: string): Promise<void>;

  /** `POST /organizations/{orgId}/rotation/configs/{configId}/rotate` */
  abstract rotateNow(organizationId: OrganizationId, configId: string): Promise<void>;

  /**
   * `POST /organizations/{orgId}/rotation/configs/{configId}/record-manual`
   *
   * Acknowledges that an operator rotated a manual target system out of band, clearing the
   * config's awaiting-manual-rotation state.
   */
  abstract recordManualRotation(organizationId: OrganizationId, configId: string): Promise<void>;

  /** `DELETE /organizations/{orgId}/rotation/configs/{configId}` */
  abstract deleteRotationConfig(organizationId: OrganizationId, configId: string): Promise<void>;
}
