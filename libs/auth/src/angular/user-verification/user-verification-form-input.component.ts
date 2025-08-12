// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { animate, style, transition, trigger } from "@angular/animations";
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import {
  ControlValueAccessor,
  FormControl,
  Validators,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from "@angular/forms";
import { BehaviorSubject, Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { UserVerificationOptions } from "@bitwarden/common/auth/types/user-verification-options";
import { VerificationWithSecret } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  FormFieldModule,
  IconButtonModule,
  IconModule,
  LinkModule,
} from "@bitwarden/components";

import { UserVerificationBiometricsIcon } from "../icons";

import { ActiveClientVerificationOption } from "./active-client-verification-option.enum";

/**
 * Used for general-purpose user verification throughout the app.
 * Collects the user's master password, or if they are not using a password, prompts for an OTP via email.
 * This is exposed to the parent component via the ControlValueAccessor interface (e.g. bind it to a FormControl).
 * Use UserVerificationService to verify the user's input.
 */
@Component({
  selector: "app-user-verification-form-input",
  templateUrl: "user-verification-form-input.component.html",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: UserVerificationFormInputComponent,
    },
  ],
  animations: [
    trigger("sent", [
      transition(":enter", [style({ opacity: 0 }), animate("100ms", style({ opacity: 1 }))]),
    ]),
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    FormFieldModule,
    AsyncActionsModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    ButtonModule,
    CalloutModule,
  ],
})
export class UserVerificationFormInputComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() verificationType: "server" | "client" = "server"; // server represents original behavior
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

  @Output() activeClientVerificationOptionChange =
    new EventEmitter<ActiveClientVerificationOption>();

  @Output() biometricsVerificationResultChange = new EventEmitter<boolean>();

  readonly Icons = { UserVerificationBiometricsIcon };

  // default to false to avoid null checks in template
  userVerificationOptions: UserVerificationOptions = {
    client: {
      masterPassword: false,
      pin: false,
      biometrics: false,
    },
    server: {
      masterPassword: false,
      otp: false,
    },
  };

  ActiveClientVerificationOption = ActiveClientVerificationOption;

  private _activeClientVerificationOptionSubject =
    new BehaviorSubject<ActiveClientVerificationOption>(null);

  activeClientVerificationOption$ = this._activeClientVerificationOptionSubject.asObservable();

  set activeClientVerificationOption(value: ActiveClientVerificationOption) {
    this._activeClientVerificationOptionSubject.next(value);
  }

  get activeClientVerificationOption(): ActiveClientVerificationOption {
    return this._activeClientVerificationOptionSubject.getValue();
  }

  get hasMultipleClientVerificationOptions(): boolean {
    let optionsCount = 0;
    if (this.userVerificationOptions.client.masterPassword) {
      optionsCount++;
    }
    if (this.userVerificationOptions.client.pin) {
      optionsCount++;
    }
    if (this.userVerificationOptions.client.biometrics) {
      optionsCount++;
    }
    return optionsCount >= 2;
  }

  biometricsVerificationFailed = false;

  disableRequestOTP = false;
  sentInitialCode = false;
  sentCode = false;

  secret = new FormControl("", [
    Validators.required,
    () => {
      if (this.invalidSecret) {
        return {
          invalidSecret: {
            message: this.getInvalidSecretErrorMessage(),
          },
        };
      }
    },
  ]);

  private getInvalidSecretErrorMessage(): string {
    // must determine client or server
    if (this.verificationType === "server") {
      return this.userVerificationOptions.server.masterPassword
        ? this.i18nService.t("incorrectPassword")
        : this.i18nService.t("incorrectCode");
    } else {
      // client
      if (this.activeClientVerificationOption === ActiveClientVerificationOption.MasterPassword) {
        return this.i18nService.t("incorrectPassword");
      } else if (this.activeClientVerificationOption === ActiveClientVerificationOption.Pin) {
        return this.i18nService.t("incorrectPin");
      }
    }
  }

  private onChange: (value: VerificationWithSecret) => void;
  private destroy$ = new Subject<void>();

  constructor(
    private userVerificationService: UserVerificationService,
    private i18nService: I18nService,
  ) {}

  async ngOnInit() {
    this.userVerificationOptions =
      await this.userVerificationService.getAvailableVerificationOptions(this.verificationType);

    if (this.verificationType === "client") {
      this.setDefaultActiveClientVerificationOption();
      this.setupClientVerificationOptionChangeHandler();
    } else {
      if (this.userVerificationOptions.server.otp) {
        // New design requires requesting on load to prevent user from having to click send code
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.requestOTP();
      }
    }

    // Executing secret changes for all non biometrics verification. Biometrics doesn't have a user entered secret.
    if (this.activeClientVerificationOption !== ActiveClientVerificationOption.Biometrics) {
      this.processSecretChanges(this.secret.value);
    }

    this.secret.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((secret: string) => this.processSecretChanges(secret));
  }

  private setDefaultActiveClientVerificationOption(): void {
    // Priorities should be Bio > Pin > Master Password for speed based on design
    if (this.userVerificationOptions.client.biometrics) {
      this.activeClientVerificationOption = ActiveClientVerificationOption.Biometrics;
    } else if (this.userVerificationOptions.client.pin) {
      this.activeClientVerificationOption = ActiveClientVerificationOption.Pin;
    } else if (this.userVerificationOptions.client.masterPassword) {
      this.activeClientVerificationOption = ActiveClientVerificationOption.MasterPassword;
    } else {
      this.activeClientVerificationOption = ActiveClientVerificationOption.None;
    }
  }

  private setupClientVerificationOptionChangeHandler(): void {
    this.activeClientVerificationOption$
      .pipe(takeUntil(this.destroy$))
      .subscribe((activeClientVerificationOption: ActiveClientVerificationOption) => {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.handleActiveClientVerificationOptionChange(activeClientVerificationOption);
      });
  }

  private async handleActiveClientVerificationOptionChange(
    activeClientVerificationOption: ActiveClientVerificationOption,
  ): Promise<void> {
    // Emit to parent component so it can implement behavior if needed.
    this.activeClientVerificationOptionChange.emit(activeClientVerificationOption);

    // clear secret value when switching verification methods
    this.secret.setValue(null);

    // Reset validation errors when swapping active client verification options
    this.secret.markAsUntouched();
    this.secret.updateValueAndValidity({ emitEvent: false });

    // if changing to biometrics, we need to prompt for biometrics
    if (activeClientVerificationOption === "biometrics") {
      // reset biometrics failed
      this.biometricsVerificationFailed = false;
      await this.verifyUserViaBiometrics();
    }
  }

  async verifyUserViaBiometrics() {
    this.biometricsVerificationFailed = false;

    const biometricsResult = await this.userVerificationService.verifyUser({
      type: VerificationType.Biometrics,
    });

    this.biometricsVerificationResultChange.emit(biometricsResult);

    this.biometricsVerificationFailed = !biometricsResult;
  }

  requestOTP = async () => {
    if (!this.userVerificationOptions.server.masterPassword) {
      this.disableRequestOTP = true;
      try {
        await this.userVerificationService.requestOTP();
        this.sentCode = true;
        this.sentInitialCode = true;

        // after 3 seconds reset sentCode to false
        setTimeout(() => {
          this.sentCode = false;
        }, 3000);
      } finally {
        this.disableRequestOTP = false;
      }
    }
  };

  writeValue(obj: any): void {
    this.secret.setValue(obj);
  }

  /** Required for NG_VALUE_ACCESSOR */
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  /** Required for NG_VALUE_ACCESSOR */
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

  processSecretChanges(secret: string) {
    this.invalidSecret = false;

    // Short circuit secret change handling when biometrics is chosen as biometrics has no secret
    if (this.activeClientVerificationOption === ActiveClientVerificationOption.Biometrics) {
      return;
    }

    if (this.onChange == null) {
      return;
    }

    this.onChange({
      type: this.determineVerificationWithSecretType(),
      secret: Utils.isNullOrWhitespace(secret) ? null : secret,
    });
  }

  private determineVerificationWithSecretType():
    | VerificationType.MasterPassword
    | VerificationType.OTP
    | VerificationType.PIN {
    if (this.verificationType === "server") {
      return this.userVerificationOptions.server.masterPassword
        ? VerificationType.MasterPassword
        : VerificationType.OTP;
    } else {
      // client
      return this.userVerificationOptions.client.masterPassword &&
        this.activeClientVerificationOption === ActiveClientVerificationOption.MasterPassword
        ? VerificationType.MasterPassword
        : VerificationType.PIN;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
