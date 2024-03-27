import { Directive } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, of } from "rxjs";
import { filter, first, switchMap, tap } from "rxjs/operators";

import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { OrganizationUserResetPasswordEnrollmentRequest } from "@bitwarden/common/admin-console/abstractions/organization-user/requests";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { OrganizationAutoEnrollStatusResponse } from "@bitwarden/common/admin-console/models/response/organization-auto-enroll-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import {
  HashPurpose,
  DEFAULT_KDF_TYPE,
  DEFAULT_KDF_CONFIG,
} from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { ChangePasswordComponent as BaseChangePasswordComponent } from "./change-password.component";

@Directive()
export class SetPasswordComponent extends BaseChangePasswordComponent {
  syncLoading = true;
  showPassword = false;
  hint = "";
  orgSsoIdentifier: string = null;
  orgId: string;
  resetPasswordAutoEnroll = false;
  onSuccessfulChangePassword: () => Promise<void>;
  successRoute = "vault";
  userId: UserId;

  forceSetPasswordReason: ForceSetPasswordReason = ForceSetPasswordReason.None;
  ForceSetPasswordReason = ForceSetPasswordReason;

  constructor(
    private accountService: AccountService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    i18nService: I18nService,
    cryptoService: CryptoService,
    messagingService: MessagingService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    platformUtilsService: PlatformUtilsService,
    private policyApiService: PolicyApiServiceAbstraction,
    policyService: PolicyService,
    protected router: Router,
    private apiService: ApiService,
    private syncService: SyncService,
    private route: ActivatedRoute,
    stateService: StateService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationUserService: OrganizationUserService,
    private userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    private ssoLoginService: SsoLoginServiceAbstraction,
    dialogService: DialogService,
  ) {
    super(
      i18nService,
      cryptoService,
      messagingService,
      passwordGenerationService,
      platformUtilsService,
      policyService,
      stateService,
      dialogService,
    );
  }

  async ngOnInit() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    super.ngOnInit();

    await this.syncService.fullSync(true);
    this.syncLoading = false;

    this.userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;

    this.forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(this.userId),
    );

    this.route.queryParams
      .pipe(
        first(),
        switchMap((qParams) => {
          if (qParams.identifier != null) {
            return of(qParams.identifier);
          } else {
            // Try to get orgSsoId from state as fallback
            // Note: this is primarily for the TDE user w/out MP obtains admin MP reset permission scenario.
            return this.ssoLoginService.getActiveUserOrganizationSsoIdentifier();
          }
        }),
        filter((orgSsoId) => orgSsoId != null),
        tap((orgSsoId: string) => {
          this.orgSsoIdentifier = orgSsoId;
        }),
        switchMap((orgSsoId: string) => this.organizationApiService.getAutoEnrollStatus(orgSsoId)),
        tap((orgAutoEnrollStatusResponse: OrganizationAutoEnrollStatusResponse) => {
          this.orgId = orgAutoEnrollStatusResponse.id;
          this.resetPasswordAutoEnroll = orgAutoEnrollStatusResponse.resetPasswordEnabled;
        }),
        switchMap((orgAutoEnrollStatusResponse: OrganizationAutoEnrollStatusResponse) =>
          // Must get org id from response to get master password policy options
          this.policyApiService.getMasterPasswordPolicyOptsForOrgUser(
            orgAutoEnrollStatusResponse.id,
          ),
        ),
        tap((masterPasswordPolicyOptions: MasterPasswordPolicyOptions) => {
          this.enforcedPolicyOptions = masterPasswordPolicyOptions;
        }),
      )
      .subscribe({
        error: () => {
          this.platformUtilsService.showToast("error", null, this.i18nService.t("errorOccurred"));
        },
      });
  }

  async setupSubmitActions() {
    this.kdf = DEFAULT_KDF_TYPE;
    this.kdfConfig = DEFAULT_KDF_CONFIG;
    return true;
  }

  async performSubmitActions(
    masterPasswordHash: string,
    masterKey: MasterKey,
    userKey: [UserKey, EncString],
  ) {
    let keysRequest: KeysRequest | null = null;
    let newKeyPair: [string, EncString] | null = null;

    if (
      this.forceSetPasswordReason !=
      ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission
    ) {
      // Existing JIT provisioned user in a MP encryption org setting first password
      // Users in this state will not already have a user asymmetric key pair so must create it for them
      // We don't want to re-create the user key pair if the user already has one (TDE user case)
      newKeyPair = await this.cryptoService.makeKeyPair(userKey[0]);
      keysRequest = new KeysRequest(newKeyPair[0], newKeyPair[1].encryptedString);
    }

    const request = new SetPasswordRequest(
      masterPasswordHash,
      userKey[1].encryptedString,
      this.hint,
      this.orgSsoIdentifier,
      keysRequest,
      this.kdf,
      this.kdfConfig.iterations,
      this.kdfConfig.memory,
      this.kdfConfig.parallelism,
    );
    try {
      if (this.resetPasswordAutoEnroll) {
        this.formPromise = this.apiService
          .setPassword(request)
          .then(async () => {
            await this.onSetPasswordSuccess(masterKey, userKey, newKeyPair);
            return this.organizationApiService.getKeys(this.orgId);
          })
          .then(async (response) => {
            if (response == null) {
              throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
            }
            const publicKey = Utils.fromB64ToArray(response.publicKey);

            // RSA Encrypt user key with organization public key
            const userKey = await this.cryptoService.getUserKey();
            const encryptedUserKey = await this.cryptoService.rsaEncrypt(userKey.key, publicKey);

            const resetRequest = new OrganizationUserResetPasswordEnrollmentRequest();
            resetRequest.masterPasswordHash = masterPasswordHash;
            resetRequest.resetPasswordKey = encryptedUserKey.encryptedString;

            return this.organizationUserService.putOrganizationUserResetPasswordEnrollment(
              this.orgId,
              this.userId,
              resetRequest,
            );
          });
      } else {
        this.formPromise = this.apiService.setPassword(request).then(async () => {
          await this.onSetPasswordSuccess(masterKey, userKey, newKeyPair);
        });
      }

      await this.formPromise;

      if (this.onSuccessfulChangePassword != null) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.onSuccessfulChangePassword();
      } else {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate([this.successRoute]);
      }
    } catch {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("errorOccurred"));
    }
  }

  togglePassword(confirmField: boolean) {
    this.showPassword = !this.showPassword;
    document.getElementById(confirmField ? "masterPasswordRetype" : "masterPassword").focus();
  }

  protected async onSetPasswordSuccess(
    masterKey: MasterKey,
    userKey: [UserKey, EncString],
    keyPair: [string, EncString] | null,
  ) {
    // Clear force set password reason to allow navigation back to vault.
    await this.masterPasswordService.setForceSetPasswordReason(
      ForceSetPasswordReason.None,
      this.userId,
    );

    // User now has a password so update account decryption options in state
    const userDecryptionOpts = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptions$,
    );
    userDecryptionOpts.hasMasterPassword = true;
    await this.userDecryptionOptionsService.setUserDecryptionOptions(userDecryptionOpts);

    await this.stateService.setKdfType(this.kdf);
    await this.stateService.setKdfConfig(this.kdfConfig);
    await this.masterPasswordService.setMasterKey(masterKey, this.userId);
    await this.cryptoService.setUserKey(userKey[0]);

    // Set private key only for new JIT provisioned users in MP encryption orgs
    // Existing TDE users will have private key set on sync or on login
    if (
      keyPair !== null &&
      this.forceSetPasswordReason !=
        ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission
    ) {
      await this.cryptoService.setPrivateKey(keyPair[1].encryptedString);
    }

    const localMasterKeyHash = await this.cryptoService.hashMasterKey(
      this.masterPassword,
      masterKey,
      HashPurpose.LocalAuthorization,
    );
    await this.masterPasswordService.setMasterKeyHash(localMasterKeyHash, this.userId);
  }
}
