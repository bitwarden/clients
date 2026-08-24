import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { DaemonAssignmentRequest } from "./requests/daemon-assignment.request";
import { DaemonRegisterRequest } from "./requests/daemon-register.request";
import { RotationConfigAccountRequest } from "./requests/rotation-config-account.request";
import { RotationConfigCreateRequest } from "./requests/rotation-config-create.request";
import { RotationConfigSettingsRequest } from "./requests/rotation-config-settings.request";
import { TargetSystemCreateRequest } from "./requests/target-system-create.request";
import { TargetSystemNameRequest } from "./requests/target-system-name.request";
import { TargetSystemPolicyRequest } from "./requests/target-system-policy.request";
import { DaemonRegistrationResponse } from "./responses/daemon-registration.response";
import { RotationConfigDetailsResponse } from "./responses/rotation-config-details.response";
import { RotationConfigResponse } from "./responses/rotation-config.response";
import { RotationDaemonDetailsResponse } from "./responses/rotation-daemon-details.response";
import { RotationDaemonResponse } from "./responses/rotation-daemon.response";
import { TargetSystemResponse } from "./responses/target-system.response";
import { RotationApiService } from "./rotation-api.service";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * `ApiService`-backed {@link RotationApiService}. See the abstraction for why this speaks HTTP
 * rather than SDK, and how far that exception goes.
 *
 * Uses the user-scoped `send` overload rather than the deprecated `authed: true` one, so every
 * request is explicitly authenticated for the active account the rest of this module resolves the
 * same way.
 */
export class DefaultRotationApiService implements RotationApiService {
  constructor(
    private apiService: ApiService,
    private accountService: AccountService,
  ) {}

  // Daemons ——————————————————————————————————————————————————————————————————

  async listRotationDaemons(
    organizationId: OrganizationId,
  ): Promise<ListResponse<RotationDaemonResponse>> {
    const response = await this.send(
      "GET",
      `/organizations/${organizationId}/rotation/daemons`,
      null,
      true,
    );
    return new ListResponse(response, RotationDaemonResponse);
  }

  async getRotationDaemon(
    organizationId: OrganizationId,
    daemonId: string,
  ): Promise<RotationDaemonDetailsResponse> {
    return new RotationDaemonDetailsResponse(
      await this.send(
        "GET",
        `/organizations/${organizationId}/rotation/daemons/${daemonId}`,
        null,
        true,
      ),
    );
  }

  async registerRotationDaemon(
    organizationId: OrganizationId,
    request: DaemonRegisterRequest,
  ): Promise<DaemonRegistrationResponse> {
    return new DaemonRegistrationResponse(
      await this.send("POST", `/organizations/${organizationId}/rotation/daemons`, request, true),
    );
  }

  async enableRotationDaemon(organizationId: OrganizationId, daemonId: string): Promise<void> {
    await this.send(
      "POST",
      `/organizations/${organizationId}/rotation/daemons/${daemonId}/enable`,
      null,
      false,
    );
  }

  async disableRotationDaemon(organizationId: OrganizationId, daemonId: string): Promise<void> {
    await this.send(
      "POST",
      `/organizations/${organizationId}/rotation/daemons/${daemonId}/disable`,
      null,
      false,
    );
  }

  async deleteRotationDaemon(organizationId: OrganizationId, daemonId: string): Promise<void> {
    await this.send(
      "DELETE",
      `/organizations/${organizationId}/rotation/daemons/${daemonId}`,
      null,
      false,
    );
  }

  async assignRotationDaemon(
    organizationId: OrganizationId,
    daemonId: string,
    request: DaemonAssignmentRequest,
  ): Promise<void> {
    await this.send(
      "POST",
      `/organizations/${organizationId}/rotation/daemons/${daemonId}/assignments`,
      request,
      false,
    );
  }

  async unassignRotationDaemon(
    organizationId: OrganizationId,
    daemonId: string,
    targetSystemId: string,
  ): Promise<void> {
    await this.send(
      "DELETE",
      `/organizations/${organizationId}/rotation/daemons/${daemonId}/assignments/${targetSystemId}`,
      null,
      false,
    );
  }

  // Target systems ———————————————————————————————————————————————————————————

  async listTargetSystems(
    organizationId: OrganizationId,
  ): Promise<ListResponse<TargetSystemResponse>> {
    const response = await this.send(
      "GET",
      `/organizations/${organizationId}/rotation/target-systems`,
      null,
      true,
    );
    return new ListResponse(response, TargetSystemResponse);
  }

  async createTargetSystem(
    organizationId: OrganizationId,
    request: TargetSystemCreateRequest,
  ): Promise<TargetSystemResponse> {
    return new TargetSystemResponse(
      await this.send(
        "POST",
        `/organizations/${organizationId}/rotation/target-systems`,
        request,
        true,
      ),
    );
  }

  async enableTargetSystem(organizationId: OrganizationId, targetSystemId: string): Promise<void> {
    await this.send(
      "POST",
      `/organizations/${organizationId}/rotation/target-systems/${targetSystemId}/enable`,
      null,
      false,
    );
  }

  async disableTargetSystem(organizationId: OrganizationId, targetSystemId: string): Promise<void> {
    await this.send(
      "POST",
      `/organizations/${organizationId}/rotation/target-systems/${targetSystemId}/disable`,
      null,
      false,
    );
  }

  async renameTargetSystem(
    organizationId: OrganizationId,
    targetSystemId: string,
    request: TargetSystemNameRequest,
  ): Promise<TargetSystemResponse> {
    return new TargetSystemResponse(
      await this.send(
        "PUT",
        `/organizations/${organizationId}/rotation/target-systems/${targetSystemId}/name`,
        request,
        true,
      ),
    );
  }

  async updateTargetSystemPolicy(
    organizationId: OrganizationId,
    targetSystemId: string,
    request: TargetSystemPolicyRequest,
  ): Promise<TargetSystemResponse> {
    return new TargetSystemResponse(
      await this.send(
        "PUT",
        `/organizations/${organizationId}/rotation/target-systems/${targetSystemId}/policy`,
        request,
        true,
      ),
    );
  }

  async deleteTargetSystem(organizationId: OrganizationId, targetSystemId: string): Promise<void> {
    await this.send(
      "DELETE",
      `/organizations/${organizationId}/rotation/target-systems/${targetSystemId}`,
      null,
      false,
    );
  }

  // Managed credentials (rotation configs) ————————————————————————————————————

  async listRotationConfigs(
    organizationId: OrganizationId,
  ): Promise<ListResponse<RotationConfigResponse>> {
    const response = await this.send(
      "GET",
      `/organizations/${organizationId}/rotation/configs`,
      null,
      true,
    );
    return new ListResponse(response, RotationConfigResponse);
  }

  async createRotationConfig(
    organizationId: OrganizationId,
    request: RotationConfigCreateRequest,
  ): Promise<RotationConfigResponse> {
    return new RotationConfigResponse(
      await this.send("POST", `/organizations/${organizationId}/rotation/configs`, request, true),
    );
  }

  async getRotationConfig(
    organizationId: OrganizationId,
    configId: string,
  ): Promise<RotationConfigDetailsResponse> {
    return new RotationConfigDetailsResponse(
      await this.send(
        "GET",
        `/organizations/${organizationId}/rotation/configs/${configId}`,
        null,
        true,
      ),
    );
  }

  async updateRotationConfigSettings(
    organizationId: OrganizationId,
    configId: string,
    request: RotationConfigSettingsRequest,
  ): Promise<RotationConfigResponse> {
    return new RotationConfigResponse(
      await this.send(
        "PUT",
        `/organizations/${organizationId}/rotation/configs/${configId}/settings`,
        request,
        true,
      ),
    );
  }

  async updateRotationConfigAccount(
    organizationId: OrganizationId,
    configId: string,
    request: RotationConfigAccountRequest,
  ): Promise<RotationConfigResponse> {
    return new RotationConfigResponse(
      await this.send(
        "PUT",
        `/organizations/${organizationId}/rotation/configs/${configId}/account`,
        request,
        true,
      ),
    );
  }

  async pauseRotationConfig(organizationId: OrganizationId, configId: string): Promise<void> {
    await this.send(
      "POST",
      `/organizations/${organizationId}/rotation/configs/${configId}/pause`,
      null,
      false,
    );
  }

  async resumeRotationConfig(organizationId: OrganizationId, configId: string): Promise<void> {
    await this.send(
      "POST",
      `/organizations/${organizationId}/rotation/configs/${configId}/resume`,
      null,
      false,
    );
  }

  async rotateNow(organizationId: OrganizationId, configId: string): Promise<void> {
    await this.send(
      "POST",
      `/organizations/${organizationId}/rotation/configs/${configId}/rotate`,
      null,
      false,
    );
  }

  async recordManualRotation(organizationId: OrganizationId, configId: string): Promise<void> {
    await this.send(
      "POST",
      `/organizations/${organizationId}/rotation/configs/${configId}/record-manual`,
      null,
      false,
    );
  }

  async deleteRotationConfig(organizationId: OrganizationId, configId: string): Promise<void> {
    await this.send(
      "DELETE",
      `/organizations/${organizationId}/rotation/configs/${configId}`,
      null,
      false,
    );
  }

  private async send(method: HttpMethod, path: string, body: unknown, hasResponse: boolean) {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return this.apiService.send(method, path, body, userId, hasResponse);
  }
}
