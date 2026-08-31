import { catchError, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { asUuid, SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import type {
  AccessRuleAddEditRequest,
  AccessRuleId,
  AccessRuleView,
  OrganizationId as SdkOrganizationId,
} from "@bitwarden/sdk-internal";

import { AccessRuleSdkService } from "..";

/**
 * The `bypassable_ciphers` call on the SDK's `AccessRulesClient`.
 *
 * Bridged locally rather than read off the SDK's own type, because the Rust side has it
 * (`bitwarden-pam`'s `access_rules().bypassable_ciphers()`) but the PUBLISHED `sdk-internal` this
 * repo pins does not — and CI installs the published package, so typing against the real method
 * would compile on a workspace with a locally rebuilt SDK linked in and fail in CI. Same shape of
 * bridge as `AccessRuleErrorVariant` (see `../abstractions/access-rule`), for the same reason.
 *
 * Collapse it on the version bump that ships the method: delete this type and the guard below, and
 * call `access_rules().bypassable_ciphers(...)` directly.
 *
 * Declared `Partial` because on the published package the method is absent at RUNTIME too, so it
 * has to be feature-detected rather than called and caught — calling it would log a
 * "not a function" failure on every rule-edit page load, which reads as a real backend outage.
 */
type BypassGapsCapableClient = Partial<{
  /**
   * Resolves to the ungated collection ids themselves — the SDK returns `Vec<CollectionId>`, so this
   * is a bare array over wasm, NOT an object wrapping one. Getting that wrong fails only at runtime:
   * the cast below defeats type checking, and the client tests substitute
   * {@link AccessRuleSdkService} above this bridge, so nothing but running it catches a mismatch.
   */
  bypassable_ciphers(organizationId: SdkOrganizationId, id: AccessRuleId): Promise<string[]>;
}>;

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

  async getAccessRule(organizationId: OrganizationId, id: AccessRuleId): Promise<AccessRuleView> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().access_rules().get(orgId, id);
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
    id: AccessRuleId,
    request: AccessRuleAddEditRequest,
  ): Promise<AccessRuleView> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().access_rules().update(orgId, id, request);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to update access rule: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async listBypassGaps(organizationId: OrganizationId, id: AccessRuleId): Promise<CollectionId[]> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          const client = ref.value.commercial().pam().access_rules();
          const capable = client as unknown as BypassGapsCapableClient;
          if (typeof capable.bypassable_ciphers !== "function") {
            // Published SDK predates the method: report no gaps, so the warning simply does not
            // render until the version bump. Silent on purpose — see the type's note.
            return [];
          }
          const ungatedCollectionIds = await capable.bypassable_ciphers(orgId, id);
          return ungatedCollectionIds.map((collectionId) => collectionId as CollectionId);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to list access rule bypass gaps: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async deleteAccessRule(organizationId: OrganizationId, id: AccessRuleId): Promise<void> {
    const orgId = asUuid<SdkOrganizationId>(organizationId);
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().access_rules().delete(orgId, id);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to delete access rule: ${error}`);
          throw error;
        }),
      ),
    );
  }
}
