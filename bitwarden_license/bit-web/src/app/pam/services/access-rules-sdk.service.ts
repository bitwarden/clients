import { catchError, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { asUuid, SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import type {
  AccessRuleAddEditRequest,
  AccessRuleId,
  AccessRuleView,
  OrganizationId as SdkOrganizationId,
} from "@bitwarden/sdk-internal";

import { AccessRuleSdkService } from "..";

/**
 * SDK-backed implementation of {@link AccessRuleSdkService}. Access-rule CRUD
 * goes through the Rust SDK's `commercial().pam().access_rules()` client, not
 * hand-rolled HTTP/DTOs.
 *
 * Follows the canonical per-call SDK-consumption pattern (see
 * `SendSdkApiService` in `libs/common`): resolve the active user, take a client
 * `Ref` from `SdkService.userClient$`, and dispose it (`using`) once the call
 * settles. Errors surface as-is — the SDK's flat `AccessRuleError` shape — for
 * callers to interpret via `accessRuleErrorMessage`/`isAccessRuleNotFound`
 * (`..`); this service does not wrap or translate them.
 */
export class AccessRulesSdkService extends AccessRuleSdkService {
  constructor(
    private sdkService: SdkService,
    private accountService: AccountService,
    private logService: LogService,
  ) {
    super();
  }

  async listAccessRules(organizationId: OrganizationId): Promise<AccessRuleView[]> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().access_rules().list(orgId);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to list access rules: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async getAccessRule(organizationId: OrganizationId, id: string): Promise<AccessRuleView> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value
            .commercial()
            .pam()
            .access_rules()
            .get(orgId, asUuid<AccessRuleId>(id));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to get access rule: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async createAccessRule(
    organizationId: OrganizationId,
    request: AccessRuleAddEditRequest,
  ): Promise<AccessRuleView> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().access_rules().create(orgId, request);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to create access rule: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async updateAccessRule(
    organizationId: OrganizationId,
    id: string,
    request: AccessRuleAddEditRequest,
  ): Promise<AccessRuleView> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value
            .commercial()
            .pam()
            .access_rules()
            .update(orgId, asUuid<AccessRuleId>(id), request);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to update access rule: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async deleteAccessRule(organizationId: OrganizationId, id: string): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value
            .commercial()
            .pam()
            .access_rules()
            .delete(orgId, asUuid<AccessRuleId>(id));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to delete access rule: ${error}`);
          throw error;
        }),
      ),
    );
  }
}
