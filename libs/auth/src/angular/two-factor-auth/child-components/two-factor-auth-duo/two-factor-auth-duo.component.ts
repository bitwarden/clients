import { CommonModule } from "@angular/common";
import { Component, DestroyRef, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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
  ToastService,
} from "@bitwarden/components";

import { DuoLaunchAction } from "../../two-factor-auth-component.service";

import {
  Duo2faResult,
  TwoFactorAuthDuoComponentService,
} from "./two-factor-auth-duo-component.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  selector: "app-two-factor-auth-duo",
  template: "",
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
  ],
  providers: [],
})
export class TwoFactorAuthDuoComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
   
  @Output() tokenEmitter = new EventEmitter<string>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
   
  @Input() providerData: any;

  duoFramelessUrl: string | undefined = undefined;

  constructor(
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected toastService: ToastService,
    private twoFactorAuthDuoComponentService: TwoFactorAuthDuoComponentService,
    private destroyRef: DestroyRef,
  ) {}

  async ngOnInit(): Promise<void> {
    this.twoFactorAuthDuoComponentService
      .listenForDuo2faResult$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((duo2faResult: Duo2faResult) => {
        this.tokenEmitter.emit(duo2faResult.token);
      });

    // flow must be launched by user so they can choose to remember the device or not.
    this.duoFramelessUrl = this.providerData.AuthUrl;
  }

  // Called via parent two-factor-auth component.
  async launchDuoFrameless(duoLaunchAction: DuoLaunchAction): Promise<void> {
    switch (duoLaunchAction) {
      case DuoLaunchAction.DIRECT_LAUNCH:
        await this.launchDuoFramelessDirectly();
        break;
      case DuoLaunchAction.SINGLE_ACTION_POPOUT:
        await this.twoFactorAuthDuoComponentService.openTwoFactorAuthDuoPopout?.();
        break;
      default:
        break;
    }
  }

  private async launchDuoFramelessDirectly(): Promise<void> {
    if (this.duoFramelessUrl === null || this.duoFramelessUrl === undefined) {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("duoHealthCheckResultsInNullAuthUrlError"),
      });
      return;
    }

    await this.twoFactorAuthDuoComponentService.launchDuoFrameless(this.duoFramelessUrl);
  }
}
