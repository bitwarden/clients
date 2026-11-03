import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Inject, input, OnDestroy, OnInit, Output } from "@angular/core";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AssertionOptionsResponse } from "@bitwarden/common/auth/services/webauthn-login/response/assertion-options.response";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { WebAuthnIFrame } from "@bitwarden/common/auth/webauthn-iframe";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  DialogModule,
  ButtonModule,
  LinkModule,
  TypographyModule,
  FormFieldModule,
  AsyncActionsModule,
  IconModule,
  ToastService,
} from "@bitwarden/components";

import { TwoFactorAuthWebAuthnComponentService } from "./two-factor-auth-webauthn-component.service";

export interface WebAuthnResult {
  token: string;
  remember?: boolean;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-two-factor-auth-webauthn",
  templateUrl: "two-factor-auth-webauthn.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    LinkModule,
    TypographyModule,
    ReactiveFormsModule,
    FormFieldModule,
    AsyncActionsModule,
    FormsModule,
    IconModule,
  ],
  providers: [],
})
export class TwoFactorAuthWebAuthnComponent implements OnInit, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() webAuthnResultEmitter = new EventEmitter<WebAuthnResult>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() webAuthnInNewTabEmitter = new EventEmitter<boolean>();
  /** Whether the result is being submitted. In the window, Continue is hidden until it's done. */
  readonly submitting = input(false);

  webAuthnReady = false;
  webAuthnNewTab = false;
  webAuthnSupported = false;
  /** Whether WebAuthn is done in this window with `navigator.credentials`, without the iframe. */
  webAuthnInWindow = false;
  webAuthnInWindowInProgress = false;
  /** Whether the last WebAuthn request in this window failed or was cancelled. */
  webAuthnInWindowFailed = false;
  webAuthnIframe: WebAuthnIFrame | undefined = undefined;

  constructor(
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    @Inject(WINDOW) protected win: Window,
    protected environmentService: EnvironmentService,
    protected twoFactorService: TwoFactorService,
    protected route: ActivatedRoute,
    private toastService: ToastService,
    private twoFactorAuthWebAuthnComponentService: TwoFactorAuthWebAuthnComponentService,
    private logService: LogService,
  ) {
    this.webAuthnSupported = this.platformUtilsService.supportsWebAuthn(win);
    this.webAuthnNewTab = this.twoFactorAuthWebAuthnComponentService.shouldOpenWebAuthnInNewTab();
  }

  async ngOnInit(): Promise<void> {
    this.webAuthnInNewTabEmitter.emit(this.webAuthnNewTab);
    this.webAuthnInWindow =
      this.webAuthnSupported &&
      !this.webAuthnNewTab &&
      (await this.twoFactorAuthWebAuthnComponentService.shouldAuthenticateInWindow());

    if (this.webAuthnNewTab && this.route.snapshot.paramMap.has("webAuthnResponse")) {
      this.submitWebAuthnNewTabResponse();
    } else if (this.webAuthnInWindow) {
      // Don't start the request on load: wait for the user to press Continue,
      // so the user has a chance to select "Remember me" before the WebAuthn
      // ceremony begins.
      return;
    } else {
      await this.buildWebAuthnIFrame();
    }
  }

  private submitWebAuthnNewTabResponse() {
    const webAuthnNewTabResponse = this.route.snapshot.paramMap.get("webAuthnResponse");
    const remember = this.route.snapshot.paramMap.get("remember") === "true";

    if (webAuthnNewTabResponse != null) {
      this.webAuthnResultEmitter.emit({
        token: webAuthnNewTabResponse,
        remember,
      });
    }
  }

  private async buildWebAuthnIFrame() {
    if (this.win != null && this.webAuthnSupported) {
      const env = await firstValueFrom(this.environmentService.environment$);
      const webVaultUrl = env.getWebVaultUrl();
      this.webAuthnIframe = new WebAuthnIFrame(
        this.win,
        webVaultUrl,
        this.webAuthnNewTab,
        this.platformUtilsService,
        this.i18nService,
        (token: string) => {
          this.webAuthnResultEmitter.emit({ token });
        },
        (error: string) => {
          this.logService.error("WebAuthn error: ", error);

          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("errorOccurred"),
            message: this.i18nService.t("webauthnCancelOrTimeout"),
          });
        },
        (info: string) => {
          if (info === "ready") {
            this.webAuthnReady = true;
          }
        },
      );

      if (!this.webAuthnNewTab) {
        setTimeout(async () => {
          await this.authWebAuthn();
        }, 500);
      }
    }
  }

  ngOnDestroy(): void {
    this.cleanupWebAuthnIframe();
  }

  async authWebAuthn() {
    const providers = await this.twoFactorService.getProviders();

    if (providers == null) {
      this.logService.error("No 2FA providers found. Unable to authenticate with WebAuthn.");
      return;
    }

    const providerData = providers?.get(TwoFactorProviderType.WebAuthn);

    if (this.webAuthnInWindow) {
      await this.authWebAuthnInWindow(providerData);
      return;
    }

    if (!this.webAuthnSupported || this.webAuthnIframe == null) {
      return;
    }

    this.webAuthnIframe.init(providerData);
  }

  private async authWebAuthnInWindow(providerData: Record<string, unknown> | undefined) {
    if (providerData == null || this.webAuthnInWindowInProgress || this.submitting()) {
      return;
    }
    this.webAuthnInWindowInProgress = true;
    try {
      // The WebAuthn provider data holds the assertion options, in the same format as for login.
      const options = new AssertionOptionsResponse(providerData);
      const token = await this.twoFactorAuthWebAuthnComponentService.authenticateInWindow(
        options,
        this.win,
      );
      this.webAuthnInWindowFailed = false;
      this.webAuthnResultEmitter.emit({ token });
    } catch (error) {
      this.webAuthnInWindowFailed = true;
      this.logService.error("WebAuthn error: ", error);
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("webauthnCancelOrTimeout"),
      });
    } finally {
      this.webAuthnInWindowInProgress = false;
    }
  }

  private cleanupWebAuthnIframe() {
    if (this.webAuthnIframe != null) {
      this.webAuthnIframe.stop();
      this.webAuthnIframe.cleanup();
    }
  }
}
