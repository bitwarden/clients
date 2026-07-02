import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { DefaultSetInitialPasswordService } from "@bitwarden/angular/auth/password-management/set-initial-password/default-set-initial-password.service.implementation";
import {
  InitializeJitPasswordCredentials,
  SetInitialPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordUserType,
} from "@bitwarden/angular/auth/password-management/set-initial-password/set-initial-password.service.abstraction";
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite/organization-invite.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
import { RouterService } from "@bitwarden/web-vault/app/core";

export class WebSetInitialPasswordService
  extends DefaultSetInitialPasswordService
  implements SetInitialPasswordService
{
  constructor(
    protected apiService: ApiService,
    protected encryptService: EncryptService,
    protected i18nService: I18nService,
    protected kdfConfigService: KdfConfigService,
    protected keyService: KeyService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected organizationUserApiService: OrganizationUserApiService,
    protected userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    private organizationInviteService: OrganizationInviteService,
    private routerService: RouterService,
    protected accountCryptographicStateService: AccountCryptographicStateService,
    protected registerSdkService: RegisterSdkService,
  ) {
    super(
      apiService,
      encryptService,
      i18nService,
      kdfConfigService,
      keyService,
      masterPasswordApiService,
      masterPasswordService,
      organizationApiService,
      organizationUserApiService,
      userDecryptionOptionsService,
      accountCryptographicStateService,
      registerSdkService,
    );
  }

  /**
   * @deprecated use `initializePasswordJitPasswordUserV2Encryption()` instead
   */
  override async setInitialPassword(
    credentials: SetInitialPasswordCredentials,
    userType: SetInitialPasswordUserType,
    userId: UserId,
  ) {
    await super.setInitialPassword(credentials, userType, userId);

    /**
     * TODO: Investigate refactoring the following logic in https://bitwarden.atlassian.net/browse/PM-22615
     * ---
     * When a user joins an org, they can be accepted into it via three paths that all
     * converge here for state cleanup:
     *
     *  1) Direct invite (emailed link) — AcceptOrgDirectInviteComponent stashes a
     *     DirectOrganizationInvite in state. If the user has no account AND the org
     *     enforces SSO, the component redirects to /sso to accelerate JIT provisioning.
     *
     *  2) Open invite (shared link) — AcceptOrgOpenInviteComponent stashes an
     *     OpenOrganizationInvite in state. For SSO-required orgs the same redirect to
     *     /sso happens for unauthed users, entering the same JIT provisioning path.
     *
     *  3) SSO login with JIT provisioning — ExternalCallback creates an Invited
     *     OrganizationUser row scoped to the SSO org, and this finish-registration
     *     path accepts it server-side (see server - SetInitialMasterPasswordCommand.cs).
     *     Whether or not an invite (of either kind) was stashed in state up front,
     *     the JIT accept happens by SSO-org lookup, not by reading client state.
     *
     * `clearOrganizationInvite()` clears both direct + open state keys.
     * `getAndClearLoginRedirectUrl()` removes any /accept-organization or /join deep-link
     * so `deepLinkGuard` doesn't replay it after JIT completes.
     */
    await this.routerService.getAndClearLoginRedirectUrl();
    await this.organizationInviteService.clearOrganizationInvite();
  }

  override async initializePasswordJitPasswordUserV2Encryption(
    credentials: InitializeJitPasswordCredentials,
    userId: UserId,
  ): Promise<void> {
    await super.initializePasswordJitPasswordUserV2Encryption(credentials, userId);

    // TODO: Investigate refactoring the following logic in https://bitwarden.atlassian.net/browse/PM-22615
    await this.routerService.getAndClearLoginRedirectUrl();
    await this.organizationInviteService.clearOrganizationInvite();
  }
}
