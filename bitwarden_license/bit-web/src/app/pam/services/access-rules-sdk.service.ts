import { catchError, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { asUuid, SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import type {
  AccessRuleAddEditRequest,
  AccessRuleId,
  AccessRuleView,
  OrganizationId as SdkOrganizationId,
} from "@bitwarden/sdk-internal";

/**
 * SDK-backed implementation of the access-rule CRUD surface consumed by
 * {@link DefaultPamApiService} (composed there, not `@Injectable` itself — this
 * is a plain class like `SendSdkApiService`). Access-rule CRUD moved off
 * hand-rolled HTTP/DTOs onto the Rust SDK's `commercial().pam().access_rules()`
 * client; every other PAM surface (leases, requests, audit) stays on
 * `ApiService`/`send()` in `DefaultPamApiService`.
 *
 * Follows the canonical per-call SDK-consumption pattern (see
 * `SendSdkApiService` in `libs/common`): resolve the active user, take a client
 * `Ref` from `SdkService.userClient$`, and dispose it (`using`) once the call
 * settles. Errors surface as-is — the SDK's flat `AccessRuleError` shape — for
 * callers to interpret via `accessRuleErrorMessage`/`isAccessRuleNotFound`
 * (`@bitwarden/bit-pam`); this service does not wrap or translate them.
 */
export class AccessRulesSdkService {
  constructor(
    private sdkService: SdkService,
    private accountService: AccountService,
    private logService: LogService,
  ) {}

  async listAccessRules(organizationId: string): Promise<AccessRuleView[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value
            .commercial()
            .pam()
            .access_rules()
            .list(asUuid<SdkOrganizationId>(organizationId));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to list access rules: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async getAccessRule(organizationId: string, id: string): Promise<AccessRuleView> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value
            .commercial()
            .pam()
            .access_rules()
            .get(asUuid<SdkOrganizationId>(organizationId), asUuid<AccessRuleId>(id));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to get access rule: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async createAccessRule(
    organizationId: string,
    request: AccessRuleAddEditRequest,
  ): Promise<AccessRuleView> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value
            .commercial()
            .pam()
            .access_rules()
            .create(asUuid<SdkOrganizationId>(organizationId), request);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to create access rule: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async updateAccessRule(
    organizationId: string,
    id: string,
    request: AccessRuleAddEditRequest,
  ): Promise<AccessRuleView> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value
            .commercial()
            .pam()
            .access_rules()
            .update(asUuid<SdkOrganizationId>(organizationId), asUuid<AccessRuleId>(id), request);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to update access rule: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async deleteAccessRule(organizationId: string, id: string): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value
            .commercial()
            .pam()
            .access_rules()
            .delete(asUuid<SdkOrganizationId>(organizationId), asUuid<AccessRuleId>(id));
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to delete access rule: ${error}`);
          throw error;
        }),
      ),
    );
  }
}
