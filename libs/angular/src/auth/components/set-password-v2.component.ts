import { Directive, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { filter, first, firstValueFrom, map, of, switchMap, tap } from "rxjs";

import { PasswordInputResult } from "@bitwarden/auth/angular";
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { OrganizationUserResetPasswordEnrollmentRequest } from "@bitwarden/common/admin-console/abstractions/organization-user/requests";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { OrganizationAutoEnrollStatusResponse } from "@bitwarden/common/admin-console/models/response/organization-auto-enroll-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KdfConfigService } from "@bitwarden/common/auth/abstractions/kdf-config.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { ToastService } from "@bitwarden/components";

@Directive()
export class SetPasswordV2Component implements OnInit {
  email: string;
  forceSetPasswordReason: ForceSetPasswordReason = ForceSetPasswordReason.None;
  ForceSetPasswordReason = ForceSetPasswordReason;
  formPromise: Promise<any>;
  masterPasswordPolicyOptions: MasterPasswordPolicyOptions | null = null;
  orgId: string;
  orgSsoIdentifier: string;
  passwordInputResult: PasswordInputResult;
  resetPasswordAutoEnroll = false;
  successRoute = "vault";
  syncLoading = true;
  userId: UserId;

  onSuccessfulChangePassword: () => Promise<void>;

  constructor(
    private accountService: AccountService,
    private apiService: ApiService,
    private cryptoService: CryptoService,
    private i18nService: I18nService,
    private kdfConfigService: KdfConfigService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationUserService: OrganizationUserService,
    private policyApiService: PolicyApiServiceAbstraction,
    private route: ActivatedRoute,
    private router: Router,
    private ssoLoginService: SsoLoginServiceAbstraction,
    private syncService: SyncService,
    private toastService: ToastService,
    private userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
  ) {}

  async ngOnInit() {
    this.email = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email)),
    );

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
          this.masterPasswordPolicyOptions = masterPasswordPolicyOptions;
        }),
      )
      .subscribe({
        error: () => {
          this.toastService.showToast({
            variant: "error",
            title: null,
            message: this.i18nService.t("errorOccurred"),
          });
        },
      });
  }

  async getPasswordInputResult(passwordInputResult: PasswordInputResult) {
    this.passwordInputResult = passwordInputResult;
    await this.submit();
  }

  async submit() {
    let protectedUserKey: [UserKey, EncString] = null;
    const userKey = await firstValueFrom(this.cryptoService.userKey$(this.userId));

    if (userKey == null) {
      protectedUserKey = await this.cryptoService.makeUserKey(this.passwordInputResult.masterKey);
    } else {
      protectedUserKey = await this.cryptoService.encryptUserKeyWithMasterKey(
        this.passwordInputResult.masterKey,
      );
    }

    await this.performSubmitActions(
      this.passwordInputResult.masterKeyHash,
      this.passwordInputResult.masterKey,
      protectedUserKey,
    );
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
      this.passwordInputResult.hint,
      this.orgSsoIdentifier,
      keysRequest,
      this.passwordInputResult.kdfConfig.kdfType,
      this.passwordInputResult.kdfConfig.iterations,
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
            const userKey = await firstValueFrom(this.cryptoService.userKey$(this.userId));
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
        return this.onSuccessfulChangePassword();
      } else {
        return this.router.navigate([this.successRoute]);
      }
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
    }
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
    await this.kdfConfigService.setKdfConfig(this.userId, this.passwordInputResult.kdfConfig);
    await this.masterPasswordService.setMasterKey(masterKey, this.userId);
    await this.cryptoService.setUserKey(userKey[0], this.userId);

    // Set private key only for new JIT provisioned users in MP encryption orgs
    // Existing TDE users will have private key set on sync or on login
    if (
      keyPair !== null &&
      this.forceSetPasswordReason !=
        ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission
    ) {
      await this.cryptoService.setPrivateKey(keyPair[1].encryptedString, this.userId);
    }

    await this.masterPasswordService.setMasterKeyHash(
      this.passwordInputResult.localMasterKeyHash,
      this.userId,
    );
  }
}
