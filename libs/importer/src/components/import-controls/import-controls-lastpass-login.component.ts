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
  FormFieldModule,
  IconButtonModule,
  SpinnerComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  LastPassInlineAuthUi,
  LastPassInlineStage,
} from "./direct/lastpass/lastpass-inline-auth-ui";

function setEnabled(control: FormControl<unknown>, enabled: boolean): void {
  if (enabled && control.disabled) {
    control.enable();
  } else if (!enabled && control.enabled) {
    control.disable();
  }
}

/** Renders one LastPass login prompt in the import card and owns the form behind it. The parent's
 *  Continue button answers the prompt through `LastPassInlineAuthUi.answer()`. */
@Component({
  selector: "importer-controls-lastpass-login",
  templateUrl: "./import-controls-lastpass-login.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormFieldModule,
    I18nPipe,
    IconButtonModule,
    InputVerbatimDirective,
    NgTemplateOutlet,
    ReactiveFormsModule,
    SpinnerComponent,
    TypographyModule,
  ],
  host: { class: "tw-contents" },
})
export class ImportControlsLastPassLoginComponent {
  readonly stage = input.required<LastPassInlineStage>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly lastPassUi = inject(LastPassInlineAuthUi);
  private readonly i18nService = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Set while the field shows LastPass's rejection of the previous value. A validator rather than
   *  `setErrors`, because re-creating the input re-runs validation and wipes manual errors. */
  private readonly codeRejected = signal(false);
  private readonly passwordRejected = signal(false);

  private readonly codeValidator: ValidatorFn = (control) => {
    if (untracked(this.codeRejected) && control.pristine) {
      return {
        lastPassCodeRejected: { message: this.i18nService.t("lastPassLoginCodeInvalid") },
      };
    }
    return (control.value ?? "").trim().length > 0
      ? null
      : { lastPassCodeRequired: { message: this.i18nService.t("verificationCodeRequired") } };
  };

  private readonly passwordValidator: ValidatorFn = (control) => {
    if (untracked(this.passwordRejected) && control.pristine) {
      return {
        lastPassPasswordRejected: {
          message: this.i18nService.t("lastPassLoginPasswordInvalid"),
        },
      };
    }
    return (control.value ?? "").length > 0
      ? null
      : {
          lastPassPasswordRequired: {
            message: this.i18nService.t("lastPassLoginPasswordRequired"),
          },
        };
  };

  // Custom validators first so their messages win; Validators.required kept so the asterisk renders.
  protected readonly form = inject(FormBuilder).group({
    lastPassCode: [{ value: "", disabled: true }, [this.codeValidator, Validators.required]],
    lastPassPassword: [
      { value: "", disabled: true },
      [this.passwordValidator, Validators.required],
    ],
  });

  constructor() {
    this.lastPassUi.registerAnswerer(() => this.answer());
    this.destroyRef.onDestroy(() => this.lastPassUi.registerAnswerer(undefined));

    effect(() => {
      const stage = this.stage();
      const controls = this.form.controls;

      setEnabled(controls.lastPassCode, stage.kind === "code");
      setEnabled(controls.lastPassPassword, stage.kind === "password");

      // A rejected code or password is shown on its field; a fresh prompt starts empty. Secrets
      // are cleared as soon as their prompt is over.
      const codeWasRejected = stage.kind === "code" && stage.previousCodeRejected;
      const passwordWasRejected = stage.kind === "password" && stage.previousPasswordRejected;
      this.codeRejected.set(codeWasRejected);
      this.passwordRejected.set(passwordWasRejected);

      controls.lastPassCode.reset("");
      controls.lastPassPassword.reset("");
      if (codeWasRejected) {
        controls.lastPassCode.markAsTouched();
      }
      if (passwordWasRejected) {
        controls.lastPassPassword.markAsTouched();
      }
    });

    // The card has to move focus itself, or it is left on a Continue button that has just been
    // disabled.
    afterRenderEffect(() => {
      this.stage();
      this.host.nativeElement
        .querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), [role="status"]')
        ?.focus();
    });
  }

  /** Answers the prompt that is showing from its field. An invalid field is only marked. */
  private answer(): void {
    const controls = this.form.controls;
    switch (this.stage().kind) {
      case "password":
        this.answerField(controls.lastPassPassword, (password) => password);
        break;
      case "code":
        this.answerField(controls.lastPassCode, (code) => code.trim());
        break;
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
    this.lastPassUi.submit(toValue(control.value ?? ""));
  }
}
