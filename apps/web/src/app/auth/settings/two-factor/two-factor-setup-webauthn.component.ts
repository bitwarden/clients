import { CommonModule } from "@angular/common";
import { Component, Inject, NgZone } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { UpdateTwoFactorWebAuthnDeleteRequest } from "@bitwarden/common/auth/models/request/update-two-factor-web-authn-delete.request";
import { UpdateTwoFactorWebAuthnRequest } from "@bitwarden/common/auth/models/request/update-two-factor-web-authn.request";
import {
  ChallengeResponse,
  TwoFactorWebAuthnResponse,
} from "@bitwarden/common/auth/models/response/two-factor-web-authn.response";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
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
  IconModule,
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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
    IconModule,
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

  override componentName = "app-two-factor-webauthn";

  protected formGroup: FormGroup;

  constructor(
    @Inject(DIALOG_DATA) protected data: AuthResponse<TwoFactorWebAuthnResponse>,
    private dialogRef: DialogRef,
    twoFactorService: TwoFactorService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    private ngZone: NgZone,
    logService: LogService,
    userVerificationService: UserVerificationService,
    dialogService: DialogService,
    toastService: ToastService,
  ) {
    super(
      twoFactorService,
      i18nService,
      platformUtilsService,
      logService,
      userVerificationService,
      dialogService,
      toastService,
    );
    this.formGroup = new FormGroup({
      name: new FormControl({ value: "", disabled: false }, Validators.required),
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

    const response = await this.twoFactorService.putTwoFactorWebAuthn(request);
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
      key.removePromise = this.twoFactorService.deleteTwoFactorWebAuthn(request);
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
    this.challengePromise = this.twoFactorService.getTwoFactorWebAuthnChallenge(request);
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

  private findNextAvailableKeyId(existingIds: Set<number>): number {
    // Search for first gap, bounded by current key count + 1
    for (let i = 1; i <= existingIds.size + 1; i++) {
      if (!existingIds.has(i)) {
        return i;
      }
    }

    // This should never be reached due to loop bounds, but TypeScript requires a return
    throw new Error("Unable to find next available key ID");
  }

  private processResponse(response: TwoFactorWebAuthnResponse) {
    if (!response.keys || response.keys.length === 0) {
      response.keys = [];
    }
    this.resetWebAuthn();
    this.keys = [];
    this.keyIdAvailable = null;
    const nameControl = this.formGroup.get("name");
    if (nameControl) {
      nameControl.enable();
      nameControl.setValue("");
    }
    this.keysConfiguredCount = 0;

    // Build configured keys
    for (const key of response.keys) {
      this.keysConfiguredCount++;
      this.keys.push({
        id: key.id,
        name: key.name,
        configured: true,
        migrated: key.migrated,
        removePromise: null,
      });
    }

    // [PM-20109]: To accommodate the existing form logic with minimal changes,
    // we need to have at least one unconfigured key slot available to the collection.
    // Prior to PM-20109, both client and server had hard checks for IDs <= 5.
    // While we don't have any technical constraints _at this time_, we should avoid
    // unbounded growth of key IDs over time as users add/remove keys;
    // this strategy gap-fills key IDs.
    const existingIds = new Set(response.keys.map((k) => k.id));
    const nextId = this.findNextAvailableKeyId(existingIds);

    // Add unconfigured slot, which can be used to add a new key
    this.keys.push({
      id: nextId,
      name: "",
      configured: false,
      removePromise: null,
    });
    this.keyIdAvailable = nextId;

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
