import { NgTemplateOutlet } from "@angular/common";
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
} from "@angular/core";
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from "@angular/forms";

import { InputVerbatimDirective } from "@bitwarden/angular/directives/input-verbatim.directive";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  A11yTitleDirective,
  CalloutModule,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  PopoverModule,
  RadioButtonModule,
  SpinnerComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  DeviceApprovalChannel,
  DnaMethod,
  DuoMethod,
  TwoFactorMethod,
} from "../../importers/keeper/access";

import { KeeperInlineAuthUi, KeeperInlineStage } from "./direct/keeper/keeper-inline-auth-ui";

function setEnabled(control: FormControl<unknown>, enabled: boolean): void {
  if (enabled && control.disabled) {
    control.enable();
  } else if (!enabled && control.enabled) {
    control.disable();
  }
}

/** Renders one Keeper login prompt in the import card and owns the form behind it. The parent's
 *  Continue button answers the prompt through `KeeperInlineAuthUi.answer()`.
 */
@Component({
  selector: "importer-controls-keeper-login",
  templateUrl: "./import-controls-keeper-login.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    A11yTitleDirective,
    CalloutModule,
    FormFieldModule,
    I18nPipe,
    IconButtonModule,
    InputVerbatimDirective,
    LinkModule,
    NgTemplateOutlet,
    PopoverModule,
    RadioButtonModule,
    ReactiveFormsModule,
    SpinnerComponent,
    TypographyModule,
  ],
  host: { class: "tw-contents" },
})
export class ImportControlsKeeperLoginComponent {
  readonly stage = input.required<KeeperInlineStage>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly keeperUi = inject(KeeperInlineAuthUi);
  private readonly i18nService = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Set while the field shows Keeper's rejection of the previous value. A validator rather than
   *  `setErrors`, because re-creating the input re-runs validation and wipes manual errors. */
  private readonly codeRejected = signal(false);
  private readonly passwordRejected = signal(false);

  private readonly codeValidator: ValidatorFn = (control) => {
    if (untracked(this.codeRejected) && control.pristine) {
      return { keeperCodeRejected: { message: this.i18nService.t("keeperLoginCodeInvalid") } };
    }
    return (control.value ?? "").trim().length > 0
      ? null
      : { keeperCodeRequired: { message: this.i18nService.t("verificationCodeRequired") } };
  };

  private readonly passwordValidator: ValidatorFn = (control) => {
    if (untracked(this.passwordRejected) && control.pristine) {
      return {
        keeperPasswordRejected: { message: this.i18nService.t("keeperLoginPasswordInvalid") },
      };
    }
    return (control.value ?? "").length > 0
      ? null
      : { keeperPasswordRequired: { message: this.i18nService.t("keeperLoginPasswordRequired") } };
  };

  private readonly ssoTokenValidator: ValidatorFn = (control) =>
    (control.value ?? "").trim().length > 0
      ? null
      : { keeperSsoTokenRequired: { message: this.i18nService.t("inputRequired") } };

  // Custom validators first so their messages win; Validators.required kept so the asterisk renders.
  protected readonly form = inject(FormBuilder).group({
    keeperApprovalMethod: [{ value: null as DeviceApprovalChannel | null, disabled: true }],
    keeperTwoFactorMethod: [{ value: null as TwoFactorMethod | null, disabled: true }],
    keeperDuoMethod: [{ value: null as DuoMethod | null, disabled: true }],
    keeperDnaMethod: [{ value: null as DnaMethod | null, disabled: true }],
    keeperCode: [{ value: "", disabled: true }, [this.codeValidator, Validators.required]],
    keeperPassword: [{ value: "", disabled: true }, [this.passwordValidator, Validators.required]],
    keeperSsoToken: [{ value: "", disabled: true }, [this.ssoTokenValidator, Validators.required]],
  });

  constructor() {
    this.keeperUi.registerAnswerer(() => this.answer());
    this.destroyRef.onDestroy(() => this.keeperUi.registerAnswerer(undefined));

    effect(() => {
      const stage = this.stage();
      const controls = this.form.controls;
      const codeStage =
        (stage.kind === "approvalCode" && stage.variant === "email") ||
        (stage.kind === "twoFactorCode" && stage.needsInput);

      setEnabled(controls.keeperApprovalMethod, stage.kind === "selectApproval");
      setEnabled(controls.keeperTwoFactorMethod, stage.kind === "selectTwoFactor");
      setEnabled(controls.keeperDuoMethod, stage.kind === "selectDuo");
      setEnabled(controls.keeperDnaMethod, stage.kind === "selectDna");
      setEnabled(controls.keeperCode, codeStage);
      setEnabled(controls.keeperPassword, stage.kind === "password");
      setEnabled(controls.keeperSsoToken, stage.kind === "ssoToken");

      // Preselects the first method, as the legacy dialog did.
      if (stage.kind === "selectApproval") {
        controls.keeperApprovalMethod.setValue(stage.methods[0] ?? null);
      } else if (stage.kind === "selectTwoFactor") {
        controls.keeperTwoFactorMethod.setValue(stage.methods[0] ?? null);
      } else if (stage.kind === "selectDuo") {
        controls.keeperDuoMethod.setValue(stage.methods[0] ?? null);
      } else if (stage.kind === "selectDna") {
        controls.keeperDnaMethod.setValue(stage.methods[0] ?? null);
      }

      // A rejected code or password is shown on its field; a fresh prompt starts empty. Secrets
      // are cleared as soon as their prompt is over.
      const codeWasRejected =
        codeStage && (stage.kind === "approvalCode" || stage.kind === "twoFactorCode")
          ? stage.previousCodeRejected
          : false;
      const passwordWasRejected = stage.kind === "password" && stage.previousPasswordRejected;
      this.codeRejected.set(codeWasRejected);
      this.passwordRejected.set(passwordWasRejected);

      controls.keeperCode.reset("");
      controls.keeperPassword.reset("");
      if (codeWasRejected) {
        controls.keeperCode.markAsTouched();
      }
      if (passwordWasRejected) {
        controls.keeperPassword.markAsTouched();
      }

      controls.keeperSsoToken.reset("");
    });

    // The legacy dialog trapped focus and focused its first field; the card has to do it itself,
    // or keyboard focus is left on a Continue button that has just been disabled.
    afterRenderEffect(() => {
      this.stage();
      this.host.nativeElement
        .querySelector<HTMLElement>(
          'input[type="radio"]:checked, input:not([type="radio"]):not([type="hidden"]):not([disabled]), [role="status"]',
        )
        ?.focus();
    });
  }

  protected resend(): void {
    this.keeperUi.resend();
  }

  /** Answers the prompt that is showing from its field. An invalid field is only marked. */
  private answer(): void {
    const stage = this.stage();
    const controls = this.form.controls;
    switch (stage.kind) {
      case "selectApproval":
        this.answerMethod(controls.keeperApprovalMethod.value);
        break;
      case "selectTwoFactor":
        this.answerMethod(controls.keeperTwoFactorMethod.value);
        break;
      case "selectDuo":
        this.answerMethod(controls.keeperDuoMethod.value);
        break;
      case "selectDna":
        this.answerMethod(controls.keeperDnaMethod.value);
        break;
      case "approvalCode":
        if (stage.variant === "email") {
          this.answerField(controls.keeperCode, (code) => code.trim());
        }
        break;
      case "twoFactorCode":
        if (stage.needsInput) {
          this.answerField(controls.keeperCode, (code) => code.trim());
        } else {
          // Push-style second factor: Continue confirms the user approved it on their device.
          this.keeperUi.submit("");
        }
        break;
      case "password":
        this.answerField(controls.keeperPassword, (password) => password);
        break;
      case "ssoToken":
        this.answerField(controls.keeperSsoToken, (token) => token.trim());
        break;
      case "error":
        this.keeperUi.dismissError();
        break;
    }
  }

  private answerMethod(method: number | null): void {
    if (method != null) {
      this.keeperUi.submit(method);
    }
  }

  private answerField(
    control: FormControl<string | null>,
    toValue: (value: string) => string,
  ): void {
    if (control.invalid) {
      control.markAsTouched();
      return;
    }
    this.keeperUi.submit(toValue(control.value ?? ""));
  }

  protected approvalLabel(method: DeviceApprovalChannel): string {
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

  protected twoFactorLabel(method: TwoFactorMethod): string {
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

  protected duoLabel(method: DuoMethod): string {
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

  protected dnaLabel(method: DnaMethod): string {
    switch (method) {
      case DnaMethod.Push:
        return "pushNotification";
      case DnaMethod.Code:
        return "enterCodeManually";
      default:
        return "unknownMethod";
    }
  }

  protected twoFactorCodePrompt(method: TwoFactorMethod, hidden: boolean): string {
    if (hidden) {
      return "twoFactorCodePrompt";
    }
    switch (method) {
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
}
