import { Directive } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";
import { OrganizationUserResetPasswordEnrollmentRequest } from "@bitwarden/common/abstractions/organization-user/requests";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { HashPurpose, DEFAULT_KDF_TYPE, DEFAULT_KDF_CONFIG } from "@bitwarden/common/enums";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { ChangePasswordComponent as BaseChangePasswordComponent } from "../auth/components/change-password.component";
import { DialogServiceAbstraction } from "../services/dialog";

@Directive()
export class SetPasswordComponent extends BaseChangePasswordComponent {
  syncLoading = true;
  showPassword = false;
  hint = "";
  identifier: string = null;
  orgId: string;
  resetPasswordAutoEnroll = false;

  onSuccessfulChangePassword: () => Promise<void>;
  successRoute = "vault";

  constructor(
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
    dialogService: DialogServiceAbstraction
  ) {
    super(
      i18nService,
      cryptoService,
      messagingService,
      passwordGenerationService,
      platformUtilsService,
      policyService,
      stateService,
      dialogService
    );
  }

  async ngOnInit() {
    await this.syncService.fullSync(true);
    this.syncLoading = false;

    // eslint-disable-next-line rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      if (qParams.identifier != null) {
        this.identifier = qParams.identifier;
      }
    });

    // Automatic Enrollment Detection
    if (this.identifier != null) {
      try {
        const response = await this.organizationApiService.getAutoEnrollStatus(this.identifier);
        this.orgId = response.id;
        this.resetPasswordAutoEnroll = response.resetPasswordEnabled;
        this.enforcedPolicyOptions =
          await this.policyApiService.getMasterPasswordPoliciesForInvitedUsers(this.orgId);
      } catch {
        this.platformUtilsService.showToast("error", null, this.i18nService.t("errorOccurred"));
      }
    }

    super.ngOnInit();
  }

  async setupSubmitActions() {
    this.kdf = DEFAULT_KDF_TYPE;
    this.kdfConfig = DEFAULT_KDF_CONFIG;
    return true;
  }

  async performSubmitActions(
    masterPasswordHash: string,
    key: SymmetricCryptoKey,
    encKey: [SymmetricCryptoKey, EncString]
  ) {
    const keys = await this.cryptoService.makeKeyPair(encKey[0]);
    const request = new SetPasswordRequest(
      masterPasswordHash,
      encKey[1].encryptedString,
      this.hint,
      this.identifier,
      new KeysRequest(keys[0], keys[1].encryptedString),
      this.kdf,
      this.kdfConfig.iterations,
      this.kdfConfig.memory,
      this.kdfConfig.parallelism
    );
    try {
      if (this.resetPasswordAutoEnroll) {
        this.formPromise = this.apiService
          .setPassword(request)
          .then(async () => {
            await this.onSetPasswordSuccess(key, encKey, keys);
            return this.organizationApiService.getKeys(this.orgId);
          })
          .then(async (response) => {
            if (response == null) {
              throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
            }
            const userId = await this.stateService.getUserId();
            const publicKey = Utils.fromB64ToArray(response.publicKey);

            // RSA Encrypt user's encKey.key with organization public key
            const userEncKey = await this.cryptoService.getEncKey();
            const encryptedKey = await this.cryptoService.rsaEncrypt(userEncKey.key, publicKey);

            const resetRequest = new OrganizationUserResetPasswordEnrollmentRequest();
            resetRequest.masterPasswordHash = masterPasswordHash;
            resetRequest.resetPasswordKey = encryptedKey.encryptedString;

            return this.organizationUserService.putOrganizationUserResetPasswordEnrollment(
              this.orgId,
              userId,
              resetRequest
            );
          });
      } else {
        this.formPromise = this.apiService.setPassword(request).then(async () => {
          await this.onSetPasswordSuccess(key, encKey, keys);
        });
      }

      await this.formPromise;

      if (this.onSuccessfulChangePassword != null) {
        this.onSuccessfulChangePassword();
      } else {
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

  private async onSetPasswordSuccess(
    key: SymmetricCryptoKey,
    encKey: [SymmetricCryptoKey, EncString],
    keys: [string, EncString]
  ) {
    await this.stateService.setKdfType(this.kdf);
    await this.stateService.setKdfConfig(this.kdfConfig);
    await this.cryptoService.setKey(key);
    await this.cryptoService.setEncKey(encKey[1].encryptedString);
    await this.cryptoService.setEncPrivateKey(keys[1].encryptedString);

    const localKeyHash = await this.cryptoService.hashPassword(
      this.masterPassword,
      key,
      HashPurpose.LocalAuthorization
    );
    await this.cryptoService.setKeyHash(localKeyHash);
  }
}
