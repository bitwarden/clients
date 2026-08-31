import { catchError, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { asUuid, SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import type {
  RotationClient,
  OrganizationId as SdkOrganizationId,
} from "@bitwarden/sdk-internal";

import type { AccessConnectorDetailView, AccessConnectorId, AccessConnectorRegistrationView, AccessConnectorView, RotationConfigCreateRequest, RotationConfigDetailView, RotationConfigId, RotationConfigUpdateRequest, RotationConfigView, TargetSystemCreateRequest, TargetSystemId, TargetSystemUpdateRequest, TargetSystemView } from "./rotation";
import { QuartzSchedulePreset, TargetSystemStatus } from "./rotation";
import { RotationConfigDescription, RotationSdkService } from "./rotation-sdk.service";

/**
 * SDK-backed {@link RotationSdkService}. Every call goes through the Rust SDK's
 * `commercial().pam().rotation()` client rather than hand-rolled HTTP and DTOs.
 *
 * Follows the canonical per-call SDK-consumption pattern used by the rest of this module (see
 * `AccessRulesSdkService`): resolve the active user, take a client `Ref` from
 * `SdkService.userClient$`, and dispose it (`using`) once the call settles. Errors surface as-is —
 * the SDK's flat `RotationError` shape — for callers to interpret; this service only logs them.
 */
export class DefaultRotationSdkService extends RotationSdkService {
  constructor(
    private sdkService: SdkService,
    private accountService: AccountService,
    private logService: LogService,
  ) {
    super();
  }

  /**
   * Runs `operation` against a freshly-taken rotation client.
   *
   * Every method here is the same five lines around one SDK call, so they share this instead:
   * resolve the user, take a `Ref`, dispose it when the call settles, and log what failed before
   * rethrowing. `description` only ever reaches the log — it names the operation, never its
   * arguments, so no organization or credential detail is written out.
   */
  private async withRotationClient<T>(
    description: string,
    operation: (rotation: RotationClient) => Promise<T> | T,
  ): Promise<T> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await operation(ref.value.commercial().pam().rotation());
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to ${description}: ${error}`);
          throw error;
        }),
      ),
    );
  }

  // Access connectors ————————————————————————————————————————————————————————

  async listConnectors(organizationId: OrganizationId): Promise<AccessConnectorView[]> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    return this.withRotationClient("list access connectors", (rotation) =>
      rotation.connectors().list(orgId),
    );
  }

  async getConnector(
    organizationId: OrganizationId,
    id: AccessConnectorId,
  ): Promise<AccessConnectorDetailView> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    return this.withRotationClient("get access connector", (rotation) =>
      rotation.connectors().get(orgId, id),
    );
  }

  async registerConnector(
    organizationId: OrganizationId,
    name: string,
  ): Promise<AccessConnectorRegistrationView> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    // The resolved value carries the one-time token. Nothing here logs it, and callers must not
    // persist it — see RotationSdkService.registerConnector.
    return this.withRotationClient("register access connector", (rotation) =>
      rotation.connectors().register(orgId, name),
    );
  }

  async enableConnector(organizationId: OrganizationId, id: AccessConnectorId): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    await this.withRotationClient("enable access connector", (rotation) =>
      rotation.connectors().enable(orgId, id),
    );
  }

  async disableConnector(organizationId: OrganizationId, id: AccessConnectorId): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    await this.withRotationClient("disable access connector", (rotation) =>
      rotation.connectors().disable(orgId, id),
    );
  }

  async deleteConnector(organizationId: OrganizationId, id: AccessConnectorId): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    await this.withRotationClient("delete access connector", (rotation) =>
      rotation.connectors().delete(orgId, id),
    );
  }

  async assignTarget(
    organizationId: OrganizationId,
    id: AccessConnectorId,
    targetSystemId: TargetSystemId,
  ): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    await this.withRotationClient("assign a target system to an access connector", (rotation) =>
      rotation.connectors().assign_target(orgId, id, targetSystemId),
    );
  }

  async unassignTarget(
    organizationId: OrganizationId,
    id: AccessConnectorId,
    targetSystemId: TargetSystemId,
  ): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    await this.withRotationClient("unassign a target system from an access connector", (rotation) =>
      rotation.connectors().unassign_target(orgId, id, targetSystemId),
    );
  }

  // Target systems ———————————————————————————————————————————————————————————

  async listTargetSystems(organizationId: OrganizationId): Promise<TargetSystemView[]> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    return this.withRotationClient("list target systems", (rotation) =>
      rotation.target_systems().list(orgId),
    );
  }

  async createTargetSystem(
    organizationId: OrganizationId,
    request: TargetSystemCreateRequest,
  ): Promise<TargetSystemView> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    return this.withRotationClient("create a target system", (rotation) =>
      rotation.target_systems().create(orgId, request),
    );
  }

  async updateTargetSystem(
    organizationId: OrganizationId,
    id: TargetSystemId,
    request: TargetSystemUpdateRequest,
  ): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    await this.withRotationClient("update a target system", (rotation) =>
      rotation.target_systems().update(orgId, id, request),
    );
  }

  async enableTargetSystem(organizationId: OrganizationId, id: TargetSystemId): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    await this.withRotationClient("enable a target system", (rotation) =>
      rotation.target_systems().enable(orgId, id),
    );
  }

  async disableTargetSystem(organizationId: OrganizationId, id: TargetSystemId): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    await this.withRotationClient("disable a target system", (rotation) =>
      rotation.target_systems().disable(orgId, id),
    );
  }

  // Managed credentials (rotation configs) ————————————————————————————————————

  async listConfigs(organizationId: OrganizationId): Promise<RotationConfigView[]> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    return this.withRotationClient("list rotation configs", (rotation) =>
      rotation.configs().list(orgId),
    );
  }

  async getConfig(
    organizationId: OrganizationId,
    id: RotationConfigId,
  ): Promise<RotationConfigDetailView> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    return this.withRotationClient("get a rotation config", (rotation) =>
      rotation.configs().get(orgId, id),
    );
  }

  async createConfig(
    organizationId: OrganizationId,
    request: RotationConfigCreateRequest,
  ): Promise<RotationConfigDetailView> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    return this.withRotationClient("create a rotation config", (rotation) =>
      rotation.configs().create(orgId, request),
    );
  }

  async updateConfig(
    organizationId: OrganizationId,
    id: RotationConfigId,
    request: RotationConfigUpdateRequest,
  ): Promise<RotationConfigDetailView> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    return this.withRotationClient("update a rotation config", (rotation) =>
      rotation.configs().update(orgId, id, request),
    );
  }

  async pauseConfig(organizationId: OrganizationId, id: RotationConfigId): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    await this.withRotationClient("pause a rotation config", (rotation) =>
      rotation.configs().pause(orgId, id),
    );
  }

  async resumeConfig(organizationId: OrganizationId, id: RotationConfigId): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    await this.withRotationClient("resume a rotation config", (rotation) =>
      rotation.configs().resume(orgId, id),
    );
  }

  async rotateNow(organizationId: OrganizationId, id: RotationConfigId): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    await this.withRotationClient("dispatch an on-demand rotation", (rotation) =>
      rotation.configs().rotate_now(orgId, id),
    );
  }

  async recordManualRotation(
    organizationId: OrganizationId,
    id: RotationConfigId,
  ): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    await this.withRotationClient("record a manual rotation", (rotation) =>
      rotation.configs().record_manual_rotation(orgId, id),
    );
  }

  async deleteConfig(organizationId: OrganizationId, id: RotationConfigId): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    await this.withRotationClient("delete a rotation config", (rotation) =>
      rotation.configs().delete(orgId, id),
    );
  }

  // Derived logic ————————————————————————————————————————————————————————————

  async describeConfigs(
    configs: readonly RotationConfigView[],
    targetStatusById: ReadonlyMap<TargetSystemId, TargetSystemStatus>,
  ): Promise<Map<RotationConfigId, RotationConfigDescription>> {
    // One client take for the whole list: both predicates are synchronous once it is in hand.
    return this.withRotationClient("describe rotation configs", (rotation) => {
      const configsClient = rotation.configs();
      const schedule = rotation.schedule();
      return new Map(
        configs.map((config) => [
          config.id,
          {
            actions: configsClient.actions(
              config,
              targetStatusById.get(config.targetSystemId) ?? null,
            ),
            schedulePreset: schedule.preset_for_cron(config.scheduleCron),
          },
        ]),
      );
    });
  }

  async presetForCron(cron: string | null): Promise<QuartzSchedulePreset> {
    return this.withRotationClient("resolve a schedule preset", (rotation) =>
      rotation.schedule().preset_for_cron(cron),
    );
  }

  async cronForPreset(preset: QuartzSchedulePreset): Promise<string | null> {
    return this.withRotationClient("resolve a preset's cron expression", (rotation) => {
      const cron = rotation.schedule().cron_for_preset(preset);
      return cron ?? null;
    });
  }

  async isLikelyQuartzCron(value: string): Promise<boolean> {
    return this.withRotationClient("check a cron expression's shape", (rotation) =>
      rotation.schedule().is_likely_quartz_cron(value),
    );
  }
}
