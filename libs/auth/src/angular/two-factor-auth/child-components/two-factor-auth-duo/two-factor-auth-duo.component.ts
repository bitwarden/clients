// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogModule } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  LinkModule,
  TypographyModule,
  FormFieldModule,
  AsyncActionsModule,
  ToastService,
} from "@bitwarden/components";

import {
  Duo2faResult,
  TwoFactorAuthDuoComponentService,
} from "./two-factor-auth-duo-component.service";

@Component({
  standalone: true,
  selector: "app-two-factor-auth-duo",
  templateUrl: "two-factor-auth-duo.component.html",
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
  providers: [I18nPipe],
})
export class TwoFactorAuthDuoComponent implements OnInit {
  @Output() token = new EventEmitter<string>();
  @Input() providerData: any;

  duoFramelessUrl: string = null;

  constructor(
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected toastService: ToastService,
    private twoFactorAuthDuoComponentService: TwoFactorAuthDuoComponentService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.twoFactorAuthDuoComponentService
      .listenForDuo2faResult$()
      .pipe(takeUntilDestroyed())
      .subscribe((duo2faResult: Duo2faResult) => {
        this.token.emit(duo2faResult.token);
      });

    // flow must be launched by user so they can choose to remember the device or not.
    this.duoFramelessUrl = this.providerData.AuthUrl;
  }

  // Called via parent two-factor-auth component.
  async launchDuoFrameless(): Promise<void> {
    if (this.duoFramelessUrl === null) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("duoHealthCheckResultsInNullAuthUrlError"),
      });
      return;
    }

    await this.twoFactorAuthDuoComponentService.launchDuoFrameless(this.duoFramelessUrl);
  }
}
