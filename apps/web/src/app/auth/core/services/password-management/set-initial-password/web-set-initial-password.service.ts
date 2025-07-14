import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { DefaultSetInitialPasswordService } from "@bitwarden/angular/auth/password-management/set-initial-password/default-set-initial-password.service.implementation";
import {
  SetInitialPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordUserType,
} from "@bitwarden/angular/auth/password-management/set-initial-password/set-initial-password.service.abstraction";
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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
    );
  }

  override async setInitialPassword(
    credentials: SetInitialPasswordCredentials,
    userType: SetInitialPasswordUserType,
    userId: UserId,
  ) {
    await super.setInitialPassword(credentials, userType, userId);

    /**
     * TODO: Investigate refactoring the following logic in https://bitwarden.atlassian.net/browse/PM-22615
     * ---
     * When a user has been invited to an org, they can be accepted into the org in two different ways:
     *
     *  1) By clicking the email invite link, which triggers the normal AcceptOrganizationComponent flow
     *     a. This flow sets an org invite in state
     *     b. However, if the user does not already have an account AND the org has SSO enabled AND the require
     *        SSO policy enabled, the AcceptOrganizationComponent will send the user to /sso to accelerate
     *        the user through the SSO JIT provisioning process (see #2 below)
     *
     *  2) By logging in via SSO, which triggers the JIT provisioning process
     *     a. This flow does NOT (itself) set an org invite in state
     *     b. The set initial password process on the server accepts the user into the org after successfully
     *        setting the password (see server - SetInitialMasterPasswordCommand.cs)
     *
     * If a user clicks the email link but gets accelerated through the SSO JIT process (see 1b),
     * the SSO JIT process will accept the user into the org upon setting their initial password (see 2b),
     * at which point we must remember to clear the deep linked URL used for accepting the org invite, as well
     * as clear the org invite itself that was originally set in state by the AcceptOrganizationComponent.
     */
    await this.routerService.getAndClearLoginRedirectUrl();
    await this.organizationInviteService.clearOrganizationInvitation();
  }
}
