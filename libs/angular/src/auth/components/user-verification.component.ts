// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { ControlValueAccessor, FormControl, Validators } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { KeyService } from "@bitwarden/key-management";

/**
 * Used for general-purpose user verification throughout the app.
 * Collects the user's master password, or if they are not using a password, prompts for an OTP via email.
 * This is exposed to the parent component via the ControlValueAccessor interface (e.g. bind it to a FormControl).
 * Use UserVerificationService to verify the user's input.
 *
 * @deprecated Jan 24, 2024: Use new libs/auth UserVerificationDialogComponent or UserVerificationFormInputComponent instead.
 * Each client specific component should eventually be converted over to use one of these new components.
 */
@Directive({
  selector: "app-user-verification",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class UserVerificationComponent implements ControlValueAccessor, OnInit, OnDestroy {
  private _invalidSecret = false;
  @Input()
  get invalidSecret() {
    return this._invalidSecret;
  }
  set invalidSecret(value: boolean) {
    this._invalidSecret = value;
    this.invalidSecretChange.emit(value);

    // ISSUE: This is pretty hacky but unfortunately there is no way of knowing if the parent
    // control has been marked as touched, see: https://github.com/angular/angular/issues/10887
    // When that functionality has been added we should also look into forwarding reactive form
    // controls errors so that we don't need a separate input/output `invalidSecret`.
    if (value) {
      this.secret.markAsTouched();
    }
    this.secret.updateValueAndValidity({ emitEvent: false });
  }
  @Output() invalidSecretChange = new EventEmitter<boolean>();

  hasMasterPassword = true;
  disableRequestOTP = false;
  sentCode = false;

  secret = new FormControl("", [
    Validators.required,
    () => {
      if (this.invalidSecret) {
        return {
          invalidSecret: {
            message: this.hasMasterPassword
              ? this.i18nService.t("incorrectPassword")
              : this.i18nService.t("incorrectCode"),
          },
        };
      }
    },
  ]);

  private onChange: (value: Verification) => void;
  private destroy$ = new Subject<void>();

  constructor(
    private keyService: KeyService,
    private userVerificationService: UserVerificationService,
    private i18nService: I18nService,
  ) {}

  async ngOnInit() {
    this.hasMasterPassword = await this.userVerificationService.hasMasterPasswordAndMasterKeyHash();
    this.processChanges(this.secret.value);

    this.secret.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((secret: string) => this.processChanges(secret));
  }

  requestOTP = async () => {
    if (!this.hasMasterPassword) {
      this.disableRequestOTP = true;
      try {
        await this.userVerificationService.requestOTP();
        this.sentCode = true;
      } finally {
        this.disableRequestOTP = false;
      }
    }
  };

  writeValue(obj: any): void {
    this.secret.setValue(obj);
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    // Not implemented
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disableRequestOTP = isDisabled;
    if (isDisabled) {
      this.secret.disable();
    } else {
      this.secret.enable();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected processChanges(secret: string) {
    this.invalidSecret = false;

    if (this.onChange == null) {
      return;
    }

    this.onChange({
      type: this.hasMasterPassword ? VerificationType.MasterPassword : VerificationType.OTP,
      secret: Utils.isNullOrWhitespace(secret) ? null : secret,
    });
  }
}
