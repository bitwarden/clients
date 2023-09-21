import { Component, NgZone } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { UpdateTwoFactorWebAuthnDeleteRequest } from "@bitwarden/common/auth/models/request/update-two-factor-web-authn-delete.request";
import { UpdateTwoFactorWebAuthnRequest } from "@bitwarden/common/auth/models/request/update-two-factor-web-authn.request";
import {
  ChallengeResponse,
  TwoFactorWebAuthnResponse,
} from "@bitwarden/common/auth/models/response/two-factor-web-authn.response";
import { AuthResponse } from "@bitwarden/common/auth/types/auth-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

import { TwoFactorBaseComponent } from "./two-factor-base.component";

interface Key {
  id: number;
  name: string;
  configured: boolean;
  migrated?: boolean;
  removePromise: Promise<TwoFactorWebAuthnResponse> | null;
}

@Component({
  selector: "app-two-factor-webauthn",
  templateUrl: "two-factor-webauthn.component.html",
})
export class TwoFactorWebAuthnComponent extends TwoFactorBaseComponent {
  type = TwoFactorProviderType.WebAuthn;
  name: string;
  keys: Key[];
  keyIdAvailable: number = null;
  keysConfiguredCount = 0;
  webAuthnError: boolean;
  webAuthnListening: boolean;
  webAuthnResponse: PublicKeyCredential;
  challengePromise: Promise<ChallengeResponse>;
  formPromise: Promise<TwoFactorWebAuthnResponse>;

  override componentName = "app-two-factor-webauthn";

  constructor(
    apiService: ApiService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    private ngZone: NgZone,
    logService: LogService,
    userVerificationService: UserVerificationService,
    dialogService: DialogService
  ) {
    super(
      apiService,
      i18nService,
      platformUtilsService,
      logService,
      userVerificationService,
      dialogService
    );
  }

  auth(authResponse: AuthResponse<TwoFactorWebAuthnResponse>) {
    super.auth(authResponse);
    this.processResponse(authResponse.response);
  }

  async submit() {
    if (this.webAuthnResponse == null || this.keyIdAvailable == null) {
      // Should never happen.
      return Promise.reject();
    }
    const request = await this.buildRequestModel(UpdateTwoFactorWebAuthnRequest);
    request.deviceResponse = this.webAuthnResponse;
    request.id = this.keyIdAvailable;
    request.name = this.name;

    return super.enable(async () => {
      this.formPromise = this.apiService.putTwoFactorWebAuthn(request);
      const response = await this.formPromise;
      await this.processResponse(response);
    });
  }

  disable() {
    return super.disable(this.formPromise);
  }

  async remove(key: Key) {
    if (this.keysConfiguredCount <= 1 || key.removePromise != null) {
      return;
    }
    const name = key.name != null ? key.name : this.i18nService.t("webAuthnkeyX", key.id as any);

    const confirmed = await this.dialogService.openSimpleDialog({
      title: name,
      content: { key: "removeU2fConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }
    const request = await this.buildRequestModel(UpdateTwoFactorWebAuthnDeleteRequest);
    request.id = key.id;
    try {
      key.removePromise = this.apiService.deleteTwoFactorWebAuthn(request);
      const response = await key.removePromise;
      key.removePromise = null;
      await this.processResponse(response);
    } catch (e) {
      this.logService.error(e);
    }
  }

  async readKey() {
    if (this.keyIdAvailable == null) {
      return;
    }
    const request = await this.buildRequestModel(SecretVerificationRequest);
    try {
      this.challengePromise = this.apiService.getTwoFactorWebAuthnChallenge(request);
      const challenge = await this.challengePromise;
      this.readDevice(challenge);
    } catch (e) {
      this.logService.error(e);
    }
  }

  private readDevice(webAuthnChallenge: ChallengeResponse) {
    // eslint-disable-next-line
    console.log("listening for key...");
    this.resetWebAuthn(true);

    navigator.credentials
      .create({
        publicKey: webAuthnChallenge,
      })
      .then((data: PublicKeyCredential) => {
        this.ngZone.run(() => {
          this.webAuthnListening = false;
          this.webAuthnResponse = data;
        });
      })
      .catch((err) => {
        // eslint-disable-next-line
        console.error(err);
        this.resetWebAuthn(false);
        // TODO: Should we display the actual error?
        this.webAuthnError = true;
      });
  }

  private resetWebAuthn(listening = false) {
    this.webAuthnResponse = null;
    this.webAuthnError = false;
    this.webAuthnListening = listening;
  }

  private processResponse(response: TwoFactorWebAuthnResponse) {
    this.resetWebAuthn();
    this.keys = [];
    this.keyIdAvailable = null;
    this.name = null;
    this.keysConfiguredCount = 0;
    for (let i = 1; i <= 5; i++) {
      if (response.keys != null) {
        const key = response.keys.filter((k) => k.id === i);
        if (key.length > 0) {
          this.keysConfiguredCount++;
          this.keys.push({
            id: i,
            name: key[0].name,
            configured: true,
            migrated: key[0].migrated,
            removePromise: null,
          });
          continue;
        }
      }
      this.keys.push({ id: i, name: null, configured: false, removePromise: null });
      if (this.keyIdAvailable == null) {
        this.keyIdAvailable = i;
      }
    }
    this.enabled = response.enabled;
  }
}
