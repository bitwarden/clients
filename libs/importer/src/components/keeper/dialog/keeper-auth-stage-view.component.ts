import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CalloutModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  RadioButtonModule,
  SpinnerComponent,
  TypographyModule,
} from "@bitwarden/components";

import {
  DeviceApprovalChannel,
  DnaMethod,
  DuoMethod,
  TwoFactorMethod,
} from "../../../importers/keeper/access";
import { KeeperAuthStage } from "../keeper-direct-import-ui.service";

type TwoFactorCodeStage = Extract<KeeperAuthStage, { kind: "twoFactorCode" }>;

import { KeeperStageShellComponent } from "./keeper-stage-shell.component";

@Component({
  selector: "keeper-auth-stage-view",
  templateUrl: "keeper-auth-stage-view.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    IconButtonModule,
    KeeperStageShellComponent,
    LinkModule,
    RadioButtonModule,
    ReactiveFormsModule,
    SpinnerComponent,
    TypographyModule,
  ],
})
export class KeeperAuthStageViewComponent {
  readonly stage = input.required<KeeperAuthStage>();
  readonly email = input<string>("");

  readonly submitted = output<unknown>();
  readonly cancelled = output<void>();
  readonly triedAnother = output<void>();
  readonly resent = output<void>();
  readonly errorDismissed = output<void>();

  private readonly i18nService = inject(I18nService);
  private readonly dialogService = inject(DialogService);

  protected readonly codeControl = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly passwordControl = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly ssoTokenControl = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly approvalMethodControl = new FormControl<DeviceApprovalChannel | null>(null);
  protected readonly twoFactorMethodControl = new FormControl<TwoFactorMethod | null>(null);
  protected readonly duoMethodControl = new FormControl<DuoMethod | null>(null);
  protected readonly dnaMethodControl = new FormControl<DnaMethod | null>(null);

  protected readonly passwordSubmitting = signal(false);

  constructor() {
    effect(() => {
      const current = this.stage();
      this.passwordSubmitting.set(false);
      if (current.kind === "selectApproval" && current.methods.length > 0) {
        this.approvalMethodControl.setValue(current.methods[0]);
      } else if (current.kind === "selectTwoFactor" && current.methods.length > 0) {
        this.twoFactorMethodControl.setValue(current.methods[0]);
      } else if (current.kind === "selectDuo" && current.methods.length > 0) {
        this.duoMethodControl.setValue(current.methods[0]);
      } else if (current.kind === "selectDna" && current.methods.length > 0) {
        this.dnaMethodControl.setValue(current.methods[0]);
      }

      const codeStageRejected =
        (current.kind === "approvalCode" && current.previousCodeRejected) ||
        (current.kind === "twoFactorCode" && current.needsInput && current.previousCodeRejected);

      if (codeStageRejected) {
        // bit-input clears `touched` on input, so the error auto-hides as
        // soon as the user starts typing a new code.
        this.codeControl.setErrors({
          keeperCodeRejected: { message: this.i18nService.t("invalidVerificationCode") },
        });
        this.codeControl.markAsTouched();
      } else if (
        current.kind === "approvalCode" ||
        (current.kind === "twoFactorCode" && current.needsInput)
      ) {
        // Fresh prompt (initial or after Resend) — drop any stale rejection
        // error left over from a prior attempt.
        this.codeControl.reset("");
      }

      if (current.kind === "password" && current.previousPasswordRejected) {
        this.passwordControl.setErrors({
          keeperPasswordRejected: { message: this.i18nService.t("invalidMasterPassword") },
        });
        this.passwordControl.markAsTouched();
      } else if (current.kind === "password") {
        this.passwordControl.reset("");
      }
    });
  }

  protected confirmApproval(): void {
    const method = this.approvalMethodControl.value;
    if (method == null) {
      return;
    }
    this.submitted.emit(method);
  }

  protected confirmTwoFactor(): void {
    const method = this.twoFactorMethodControl.value;
    if (method == null) {
      return;
    }
    this.submitted.emit(method);
  }

  protected confirmDuo(): void {
    const method = this.duoMethodControl.value;
    if (method == null) {
      return;
    }
    this.submitted.emit(method);
  }

  protected confirmDna(): void {
    const method = this.dnaMethodControl.value;
    if (method == null) {
      return;
    }
    this.submitted.emit(method);
  }

  protected submitCode(): void {
    const code = this.codeControl.value.trim();
    if (!code) {
      return;
    }
    this.codeControl.reset("");
    this.submitted.emit(code);
  }

  protected submitPush(): void {
    this.submitted.emit("");
  }

  protected submitPassword(): void {
    const password = this.passwordControl.value;
    if (!password) {
      return;
    }
    this.passwordControl.reset("");
    this.passwordSubmitting.set(true);
    this.submitted.emit(password);
  }

  protected submitSsoToken(): void {
    const token = this.ssoTokenControl.value.trim();
    if (!token) {
      return;
    }
    this.ssoTokenControl.reset("");
    this.submitted.emit(token);
  }

  protected tryAnother(): void {
    this.triedAnother.emit();
  }

  protected resend(): void {
    this.resent.emit();
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected async cancelAdminApproval(): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "approvalRequestWillBeCanceled" },
      content: { key: "pendingApprovalCancelConfirmation" },
      acceptButtonText: { key: "cancelRequest" },
      cancelButtonText: { key: "back" },
      type: "danger",
    });

    if (confirmed) {
      this.cancelled.emit();
    }
  }

  protected dismissError(): void {
    this.errorDismissed.emit();
  }

  protected getApprovalMethodLabel(method: DeviceApprovalChannel): string {
    switch (method) {
      case DeviceApprovalChannel.Email:
        return "email";
      case DeviceApprovalChannel.KeeperPush:
        return "keeperPush";
      case DeviceApprovalChannel.TwoFactor:
        return "twoFactorMethod";
      case DeviceApprovalChannel.AdminApproval:
        return "adminApproval";
      default:
        return "email";
    }
  }

  protected getTwoFactorLabel(method: TwoFactorMethod): string {
    switch (method) {
      case TwoFactorMethod.Totp:
        return "authenticatorAppTotp";
      case TwoFactorMethod.Sms:
        return "textMessageSms";
      case TwoFactorMethod.Duo:
        return "duoSecurity";
      case TwoFactorMethod.Rsa:
        return "rsaSecurId";
      case TwoFactorMethod.Backup:
        return "backupCodes";
      case TwoFactorMethod.U2f:
        return "securityKeyU2f";
      case TwoFactorMethod.WebAuthn:
        return "securityKeyWebAuthn";
      case TwoFactorMethod.KeeperPush:
        return "keeperPush";
      case TwoFactorMethod.KeeperDna:
        return "keeperDna";
      default:
        return "unknownMethod";
    }
  }

  protected getDuoLabel(method: DuoMethod): string {
    switch (method) {
      case DuoMethod.Push:
        return "duoPush";
      case DuoMethod.Sms:
        return "textMessageSms";
      case DuoMethod.Voice:
        return "phoneCall";
      case DuoMethod.Passcode:
        return "passcode";
      default:
        return "unknownMethod";
    }
  }

  protected getTwoFactorCodeTitle(stage: TwoFactorCodeStage): string {
    if (stage.hidden) {
      return "deviceApprovalNeeded";
    }
    if (!stage.needsInput) {
      return "keeperMFARequired";
    }
    return "verificationCode";
  }

  protected getTwoFactorCodePrompt(stage: TwoFactorCodeStage): string {
    if (stage.hidden) {
      return "twoFactorCodePrompt";
    }
    switch (stage.method) {
      case TwoFactorMethod.Totp:
        return "totpCodePrompt";
      case TwoFactorMethod.Sms:
        return "smsCodePrompt";
      case TwoFactorMethod.KeeperDna:
        return "keeperDnaCodePrompt";
      default:
        return "twoFactorCodePrompt";
    }
  }

  protected getDnaLabel(method: DnaMethod): string {
    switch (method) {
      case DnaMethod.Push:
        return "pushNotification";
      case DnaMethod.Code:
        return "enterCodeManually";
      default:
        return "unknownMethod";
    }
  }
}
