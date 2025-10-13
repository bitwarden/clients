import { CommonModule } from "@angular/common";
import { Component, Inject, NgZone } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
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
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  LinkModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { TwoFactorSetupMethodBaseComponent } from "./two-factor-setup-method-base.component";

interface Key {
  id: number;
  name: string;
  configured: boolean;
  migrated?: boolean;
  removePromise: Promise<TwoFactorWebAuthnResponse> | null;
}

@Component({
  selector: "app-two-factor-setup-webauthn",
  templateUrl: "two-factor-setup-webauthn.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    CommonModule,
    DialogModule,
    FormFieldModule,
    I18nPipe,
    JslibModule,
    LinkModule,
    ReactiveFormsModule,
    TypographyModule,
  ],
})
export class TwoFactorSetupWebAuthnComponent extends TwoFactorSetupMethodBaseComponent {
  type = TwoFactorProviderType.WebAuthn;
  name: string = "";
  keys: Key[] = [];
  keyIdAvailable: number | null = null;
  keysConfiguredCount = 0;
  webAuthnError: boolean = false;
  webAuthnListening: boolean = false;
  webAuthnResponse: PublicKeyCredential | null = null;
  challengePromise: Promise<ChallengeResponse> | undefined;
  formPromise: Promise<TwoFactorWebAuthnResponse> | undefined;

  override componentName = "app-two-factor-webauthn";

  protected formGroup: FormGroup;

  constructor(
    @Inject(DIALOG_DATA) protected data: AuthResponse<TwoFactorWebAuthnResponse>,
    private dialogRef: DialogRef,
    apiService: ApiService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    private ngZone: NgZone,
    logService: LogService,
    userVerificationService: UserVerificationService,
    dialogService: DialogService,
    toastService: ToastService,
  ) {
    super(
      apiService,
      i18nService,
      platformUtilsService,
      logService,
      userVerificationService,
      dialogService,
      toastService,
    );
    this.formGroup = new FormGroup({
      name: new FormControl({ value: "", disabled: false }),
    });
    this.auth(data);
  }

  auth(authResponse: AuthResponse<TwoFactorWebAuthnResponse>) {
    super.auth(authResponse);
    this.processResponse(authResponse.response);
  }

  submit = async () => {
    if (this.webAuthnResponse == null || this.keyIdAvailable == null) {
      // Should never happen.
      return Promise.reject();
    }
    return this.enable();
  };

  protected async enable() {
    const request = await this.buildRequestModel(UpdateTwoFactorWebAuthnRequest);

    if (this.webAuthnResponse == undefined || this.keyIdAvailable == undefined) {
      throw new Error("WebAuthn response or key ID is missing");
    }

    request.deviceResponse = this.webAuthnResponse;
    request.id = this.keyIdAvailable;
    request.name = this.formGroup.value.name || "";

    const response = await this.apiService.putTwoFactorWebAuthn(request);
    this.processResponse(response);
    this.toastService.showToast({
      title: this.i18nService.t("success"),
      message: this.i18nService.t("twoFactorProviderEnabled"),
      variant: "success",
    });
    this.onUpdated.emit(response.enabled);
  }

  disable = async () => {
    await this.disableMethod();
    if (!this.enabled) {
      this.onUpdated.emit(this.enabled);
      this.dialogRef.close();
    }
  };

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

  readKey = async () => {
    if (this.keyIdAvailable == null) {
      return;
    }
    const request = await this.buildRequestModel(SecretVerificationRequest);
    this.challengePromise = this.apiService.getTwoFactorWebAuthnChallenge(request);
    const challenge = await this.challengePromise;
    this.readDevice(challenge);
  };

  private readDevice(webAuthnChallenge: ChallengeResponse) {
    // eslint-disable-next-line
    console.log("listening for key...");
    this.resetWebAuthn(true);

    navigator.credentials
      .create({
        publicKey: webAuthnChallenge,
      })
      .then((data) => {
        this.ngZone.run(() => {
          this.webAuthnListening = false;
          this.webAuthnResponse = data as PublicKeyCredential;
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
    const nameControl = this.formGroup.get("name");
    if (nameControl) {
      nameControl.enable();
      nameControl.setValue("");
    }
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
      this.keys.push({ id: i, name: "", configured: false, removePromise: null });
      if (this.keyIdAvailable == null) {
        this.keyIdAvailable = i;
      }
    }
    this.enabled = response.enabled;
    this.onUpdated.emit(this.enabled);
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<AuthResponse<TwoFactorWebAuthnResponse>>,
  ) {
    return dialogService.open<boolean, AuthResponse<TwoFactorWebAuthnResponse>>(
      TwoFactorSetupWebAuthnComponent,
      config as DialogConfig<AuthResponse<TwoFactorWebAuthnResponse>, DialogRef<boolean>>,
    );
  }
}
