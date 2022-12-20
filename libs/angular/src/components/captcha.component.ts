import { AfterViewInit, Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";

import { EnvironmentService } from "@bitwarden/common/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { IFrameComponent } from "@bitwarden/common/misc/iframe_component";
import { Utils } from "@bitwarden/common/misc/utils";

/**
 * HCaptcha component, shows the captcha and emits an event when the captcha is solved.
 */
@Component({
  selector: "app-captcha",
  template: `<iframe [id]="id" height="80"></iframe>`,
})
export class CaptchaComponent implements AfterViewInit, OnDestroy {
  @Input() siteKey: string;

  @Input() set token(token: string | undefined) {
    // Reset the captcha status if  the token is set to undefined.
    if (Utils.isNullOrWhitespace(token) && this.initialized) {
      this.logService.debug("CaptchaComponent: Resetting captcha");
      this.iframeHandler?.sendMessage("reload");
    }
  }
  @Output() tokenChange = new EventEmitter<string>();

  private iframeHandler: IFrameComponent;

  protected readonly id = "hcaptcha_iframe";
  private readonly connectorUrl = "captcha-connector.html";
  private initialized = false;

  constructor(
    protected environmentService: EnvironmentService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected logService: LogService
  ) {}

  ngAfterViewInit(): void {
    const webVaultUrl = this.environmentService.getWebVaultUrl();

    this.iframeHandler = new IFrameComponent(
      window,
      webVaultUrl,
      this.connectorUrl,
      this.id,
      (token: string) => {
        this.tokenChange.emit(token);
      },
      (error: string) => {
        this.platformUtilsService.showToast("error", this.i18nService.t("errorOccurred"), error);
      },
      (message: string) => {
        const parsedMessage = JSON.parse(message);
        if (typeof parsedMessage !== "string") {
          this.iframeHandler.iframe.height = parsedMessage.height.toString();
          this.iframeHandler.iframe.width = parsedMessage.width.toString();
        } else {
          this.platformUtilsService.showToast("info", this.i18nService.t("info"), parsedMessage);
        }
      }
    );

    const data = {
      siteKey: this.siteKey,
      locale: this.i18nService.translationLocale,
    };
    const params = this.iframeHandler.createParams(data, 1);
    this.iframeHandler.initComponent(params);
    this.initialized = true;
  }

  ngOnDestroy(): void {
    this.iframeHandler.cleanup();
  }
}
