import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { isActive, Router } from "@angular/router";
import { combineLatest, firstValueFrom, map, Observable, switchMap } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordEnrollmentRequest,
} from "@bitwarden/admin-console/common";
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  DialogService,
  IconButtonModule,
  IconModule,
  MenuModule,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  ALL_ITEMS_SCOPE,
  OrganizationFilter,
  VAULT_BASE_ROUTE,
  vaultScopeCommands,
  VaultScopeType,
} from "@bitwarden/vault";

import { OrganizationUserResetPasswordService } from "../../../../admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service";
import { EnrollMasterPasswordReset } from "../../../../admin-console/organizations/users/enroll-master-password-reset.component";
import { LinkSsoService } from "../../../../auth/core/services";
import { OptionsInput } from "../shared/components/vault-filter-section.component";

type MenuState = {
  organization: Organization;
  allowEnrollmentChanges: boolean;
  showSso: boolean;
  showLeave: boolean;
};

/**
 * The options menu for an organization the user belongs to: account recovery enrollment, SSO
 * linking, and leaving the organization.
 *
 * TODO: with the VFO1Foundation flag, move this component out of `individual-vault/vault-filter/`.
 */
@Component({
  selector: "app-organization-options",
  templateUrl: "organization-options.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18nPipe, IconButtonModule, IconModule, MenuModule],
})
export class OrganizationOptionsComponent {
  /** The organization to show options for. Set by the vault side nav. */
  readonly organizationId = input<OrganizationId>();

  /**
   * The organization node the legacy vault filter provides.
   *
   * TODO: remove with the VFO1Foundation flag, along with the branch that reads it in
   * `organization$`. Then make `organizationId` required.
   */
  private readonly optionsInput$ = inject<Observable<OrganizationFilter>>(OptionsInput, {
    optional: true,
  });

  private readonly i18nService = inject(I18nService);
  private readonly apiService = inject(ApiService);
  private readonly syncService = inject(SyncService);
  private readonly policyService = inject(PolicyService);
  private readonly logService = inject(LogService);
  private readonly validationService = inject(ValidationService);
  private readonly organizationApiService = inject(OrganizationApiServiceAbstraction);
  private readonly organizationUserApiService = inject(OrganizationUserApiService);
  private readonly userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);
  private readonly dialogService = inject(DialogService);
  private readonly resetPasswordService = inject(OrganizationUserResetPasswordService);
  private readonly userVerificationService = inject(UserVerificationService);
  private readonly toastService = inject(ToastService);
  private readonly organizationService = inject(OrganizationService);
  private readonly keyService = inject(KeyService);
  private readonly accountService = inject(AccountService);
  private readonly linkSsoService = inject(LinkSsoService);
  private readonly ssoLoginService = inject(SsoLoginServiceAbstraction);
  private readonly router = inject(Router);
  private readonly vaultBaseRoute = inject(VAULT_BASE_ROUTE);

  /** TODO: remove with the VFO1Foundation flag, along with the legacy trigger button. */
  protected readonly legacyFilter = this.optionsInput$ != null;

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly organizations$ = this.userId$.pipe(
    switchMap((userId) => this.organizationService.organizations$(userId)),
  );

  private readonly organization$: Observable<Organization | undefined> =
    // TODO: remove the `optionsInput$` branch with the VFO1Foundation flag.
    this.optionsInput$ ??
    combineLatest([toObservable(this.organizationId), this.organizations$]).pipe(
      map(([organizationId, organizations]) => organizations.find((o) => o.id === organizationId)),
    );

  /** `undefined` while loading, or once the user is no longer a member. */
  protected readonly menuState = toSignal(
    combineLatest([
      this.organization$,
      this.userId$.pipe(switchMap((userId) => this.policyService.policies$(userId))),
      this.userId$.pipe(
        switchMap((userId) => this.userDecryptionOptionsService.userDecryptionOptionsById$(userId)),
      ),
      this.organizations$.pipe(
        map((organizations) => organizations.find((o) => o.userIsClaimedByOrganization === true)),
      ),
    ]).pipe(
      map(([organization, policies, decryptionOptions, managingOrg]): MenuState | undefined => {
        if (organization == null) {
          return undefined;
        }

        const resetPasswordPolicy = policies.find(
          (p) => p.type === PolicyType.ResetPassword && p.organizationId === organization.id,
        );

        return {
          organization,
          allowEnrollmentChanges: this.allowEnrollmentChanges(organization, resetPasswordPolicy),
          showSso: !!(organization.useSso && organization.identifier),
          // A user can leave an organization if they are NOT a managed user and they are NOT using TDE and Key Connector, or they have a master password.
          showLeave:
            managingOrg?.id !== organization.id &&
            ((decryptionOptions.trustedDeviceOption == undefined &&
              decryptionOptions.keyConnectorOption == undefined) ||
              decryptionOptions.hasMasterPassword),
        };
      }),
    ),
  );

  /**
   * Links SSO to an organization.
   * @param organization The organization to link SSO to.
   */
  protected async handleLinkSso(organization: Organization) {
    try {
      await this.linkSsoService.linkSso(organization.identifier);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }

  protected async unlinkSso(org: Organization) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: org.name,
      content: { key: "unlinkSsoConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.apiService.deleteSsoUser(org.id);
      await this.syncService.fullSync(true);
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("unlinkedSso"),
      });

      await this.removeUserFromSsoRequiredCacheIfPresent();
    } catch (e) {
      this.handleApiError(e);
    }
  }

  protected async leave(org: Organization) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: org.name,
      content: { key: "leaveOrganizationConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.organizationApiService.leave(org.id);

      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("leftOrganization"),
      });

      await this.removeUserFromSsoRequiredCacheIfPresent();
      await this.navigateAwayFromOrganization(org.id);
    } catch (e) {
      this.handleApiError(e);
    }
  }

  protected async toggleResetPasswordEnrollment(org: Organization) {
    if (!org.resetPasswordEnrolled) {
      await EnrollMasterPasswordReset.open(
        this.dialogService,
        { organization: org },
        this.resetPasswordService,
        this.organizationUserApiService,
        this.i18nService,
        this.syncService,
        this.logService,
        this.userVerificationService,
        this.toastService,
        this.keyService,
        this.accountService,
        this.organizationApiService,
      );
      return;
    }

    // Remove reset password
    const request = new OrganizationUserResetPasswordEnrollmentRequest();
    request.masterPasswordHash = "ignored";
    request.resetPasswordKey = "";
    try {
      await this.organizationUserApiService.putOrganizationUserResetPasswordEnrollment(
        org.id,
        org.userId,
        request,
      );
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("withdrawPasswordResetSuccess"),
      });
      await this.syncService.fullSync(true);
    } catch (e) {
      this.handleApiError(e);
    }
  }

  private allowEnrollmentChanges(org: Organization, resetPasswordPolicy?: Policy): boolean {
    if (org.usePolicies && org.useResetPassword && org.hasPublicAndPrivateKeys) {
      if (resetPasswordPolicy != undefined && resetPasswordPolicy.enabled) {
        return !(org.resetPasswordEnrolled && resetPasswordPolicy.data.autoEnrollEnabled);
      }
    }

    return false;
  }

  /** `vaultScopeGuard` only runs on navigation, so it can't move the user off a vault they left. */
  private async navigateAwayFromOrganization(organizationId: OrganizationId) {
    const organizationVault = this.router.createUrlTree(
      vaultScopeCommands(
        { type: VaultScopeType.Organization, organizationId },
        this.vaultBaseRoute,
      ),
    );
    const viewingOrganization = isActive(organizationVault, this.router, {
      paths: "subset",
      queryParams: "ignored",
      fragment: "ignored",
      matrixParams: "ignored",
    })();

    if (viewingOrganization) {
      await this.router.navigate(vaultScopeCommands(ALL_ITEMS_SCOPE, this.vaultBaseRoute));
    }
  }

  /** The menu closes before these calls settle, so errors surface as a toast. */
  private handleApiError(e: unknown) {
    this.logService.error(e);
    this.validationService.showError(e);
  }

  /**
   * Remove the user from the cached list of users who must authenticate via SSO (if an entry is present for the user)
   */
  private async removeUserFromSsoRequiredCacheIfPresent() {
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    if (!activeAccount) {
      this.logService.error("Active account not found.");
      return;
    }

    await this.ssoLoginService.removeFromSsoRequiredCacheIfPresent(
      activeAccount.email,
      activeAccount.id,
    );
  }
}
