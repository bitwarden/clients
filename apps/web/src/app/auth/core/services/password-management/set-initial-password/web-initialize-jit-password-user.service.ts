import { DefaultInitializeJitPasswordUserService } from "@bitwarden/angular/auth/password-management/set-initial-password/default-initialize-jit-password-user.service";
import {
  InitializeJitPasswordCredentials,
  InitializeJitPasswordUserService,
} from "@bitwarden/angular/auth/password-management/set-initial-password/initialize-jit-password-user.service.abstraction";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { UserId } from "@bitwarden/user-core";
import { RouterService } from "@bitwarden/web-vault/app/core";

export class WebInitializeJitPasswordUserService implements InitializeJitPasswordUserService {
  constructor(
    private readonly initializeJitPasswordUserService: DefaultInitializeJitPasswordUserService,
    private readonly organizationInviteService: OrganizationInviteService,
    private readonly routerService: RouterService,
  ) {}

  async initializeUser(
    credentials: InitializeJitPasswordCredentials,
    userId: UserId,
  ): Promise<void> {
    await this.initializeJitPasswordUserService.initializeUser(credentials, userId);

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
