// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, of } from "rxjs";
import { filter, first, switchMap, tap } from "rxjs/operators";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordEnrollmentRequest,
} from "@bitwarden/admin-console/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { OrganizationAutoEnrollStatusResponse } from "@bitwarden/common/admin-console/models/response/organization-auto-enroll-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { DEFAULT_KDF_CONFIG, KdfConfigService, KeyService } from "@bitwarden/key-management";

import { ChangePasswordComponent as BaseChangePasswordComponent } from "./change-password.component";

@Directive()
export class SetPasswordComponent extends BaseChangePasswordComponent implements OnInit {
  syncLoading = true;
  showPassword = false;
  hint = "";
  orgSsoIdentifier: string = null;
  orgId: string;
  resetPasswordAutoEnroll = false;
  onSuccessfulChangePassword: () => Promise<void>;
  successRoute = "vault";
  activeUserId: UserId;

  forceSetPasswordReason: ForceSetPasswordReason = ForceSetPasswordReason.None;
  ForceSetPasswordReason = ForceSetPasswordReason;

  constructor(
    protected accountService: AccountService,
    protected dialogService: DialogService,
    protected encryptService: EncryptService,
    protected i18nService: I18nService,
    protected kdfConfigService: KdfConfigService,
    protected keyService: KeyService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected messagingService: MessagingService,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected organizationUserApiService: OrganizationUserApiService,
    protected platformUtilsService: PlatformUtilsService,
    protected policyApiService: PolicyApiServiceAbstraction,
    protected policyService: PolicyService,
    protected route: ActivatedRoute,
    protected router: Router,
    protected ssoLoginService: SsoLoginServiceAbstraction,
    protected syncService: SyncService,
    protected toastService: ToastService,
    protected userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
  ) {
    super(
      accountService,
      dialogService,
      i18nService,
      kdfConfigService,
      keyService,
      masterPasswordService,
      messagingService,
      platformUtilsService,
      policyService,
      toastService,
    );
  }

  async ngOnInit() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    super.ngOnInit();

    await this.syncService.fullSync(true);
    this.syncLoading = false;

    this.activeUserId = (await firstValueFrom(this.accountService.activeAccount$))?.id;

    this.forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(this.activeUserId),
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
            return this.ssoLoginService.getActiveUserOrganizationSsoIdentifier(this.activeUserId);
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
          this.toastService.showToast({
            variant: "error",
            title: null,
            message: this.i18nService.t("errorOccurred"),
          });
        },
      });
  }

  async setupSubmitActions() {
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

      // in case we have a local private key, and are not sure whether it has been posted to the server, we post the local private key instead of generating a new one
      const existingUserPrivateKey = (await firstValueFrom(
        this.keyService.userPrivateKey$(this.activeUserId),
      )) as Uint8Array;
      const existingUserPublicKey = await firstValueFrom(
        this.keyService.userPublicKey$(this.activeUserId),
      );
      if (existingUserPrivateKey != null && existingUserPublicKey != null) {
        const existingUserPublicKeyB64 = Utils.fromBufferToB64(existingUserPublicKey);
        newKeyPair = [
          existingUserPublicKeyB64,
          await this.encryptService.wrapDecapsulationKey(existingUserPrivateKey, userKey[0]),
        ];
      } else {
        newKeyPair = await this.keyService.makeKeyPair(userKey[0]);
      }
      keysRequest = new KeysRequest(newKeyPair[0], newKeyPair[1].encryptedString);
    }

    const request = new SetPasswordRequest(
      masterPasswordHash,
      userKey[1].encryptedString,
      this.hint,
      this.orgSsoIdentifier,
      keysRequest,
      this.kdfConfig.kdfType, //always PBKDF2 --> see this.setupSubmitActions
      this.kdfConfig.iterations,
    );
    try {
      if (this.resetPasswordAutoEnroll) {
        this.formPromise = this.masterPasswordApiService
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
            const userKey = await this.keyService.getUserKey();
            const encryptedUserKey = await this.encryptService.encapsulateKeyUnsigned(
              userKey,
              publicKey,
            );

            const resetRequest = new OrganizationUserResetPasswordEnrollmentRequest();
            resetRequest.masterPasswordHash = masterPasswordHash;
            resetRequest.resetPasswordKey = encryptedUserKey.encryptedString;

            return this.organizationUserApiService.putOrganizationUserResetPasswordEnrollment(
              this.orgId,
              this.activeUserId,
              resetRequest,
            );
          });
      } else {
        this.formPromise = this.masterPasswordApiService.setPassword(request).then(async () => {
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
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
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
      this.activeUserId,
    );

    // User now has a password so update account decryption options in state
    const userDecryptionOpts = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptions$,
    );
    userDecryptionOpts.hasMasterPassword = true;
    await this.userDecryptionOptionsService.setUserDecryptionOptions(userDecryptionOpts);
    await this.kdfConfigService.setKdfConfig(this.activeUserId, this.kdfConfig);
    await this.masterPasswordService.setMasterKey(masterKey, this.activeUserId);
    await this.keyService.setUserKey(userKey[0], this.activeUserId);

    // Set private key only for new JIT provisioned users in MP encryption orgs
    // Existing TDE users will have private key set on sync or on login
    if (
      keyPair !== null &&
      this.forceSetPasswordReason !=
        ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission
    ) {
      await this.keyService.setPrivateKey(keyPair[1].encryptedString, this.activeUserId);
    }

    const localMasterKeyHash = await this.keyService.hashMasterKey(
      this.masterPassword,
      masterKey,
      HashPurpose.LocalAuthorization,
    );
    await this.masterPasswordService.setMasterKeyHash(localMasterKeyHash, this.activeUserId);
  }
}
