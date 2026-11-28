// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe, NgTemplateOutlet } from "@angular/common";
import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  Optional,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { distinctUntilChanged, firstValueFrom, map, of, startWith, switchMap, tap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { TotpInfo } from "@bitwarden/common/vault/services/totp.service";
import {
  AsyncActionsModule,
  CardComponent,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  PopoverModule,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { BitTotpCountdownComponent } from "../../../components/totp-countdown/totp-countdown.component";
import { TotpUpgradeCalloutComponent } from "../../../components/totp-upgrade-callout/totp-upgrade-callout.component";
import { CipherFormGenerationService } from "../../abstractions/cipher-form-generation.service";
import { TotpCaptureService } from "../../abstractions/totp-capture.service";
import { CipherFormContainer } from "../../cipher-form-container";
import { AutofillOptionsComponent } from "../autofill-options/autofill-options.component";

import {
  DeletePasskeyDialogComponent,
  DeletePasskeyDialogResult,
} from "./delete-passkey-dialog/delete-passkey-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-login-details-section",
  templateUrl: "./login-details-section.component.html",
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    SectionHeaderComponent,
    TypographyModule,
    JslibModule,
    CardComponent,
    FormFieldModule,
    IconButtonModule,
    AsyncActionsModule,
    PopoverModule,
    AutofillOptionsComponent,
    LinkModule,
    BitTotpCountdownComponent,
    TotpUpgradeCalloutComponent,
  ],
})
export class LoginDetailsSectionComponent implements OnInit {
  EventType = EventType;
  loginDetailsForm = this.formBuilder.group({
    username: [""],
    password: [""],
    totp: [""],
  });

  /**
   * Flag indicating whether a new password has been generated for the current form.
   */
  newPasswordGenerated: boolean;

  /**
   * Whether the TOTP field can be captured from the current tab. Only available in the browser extension and
   * when not in a popout window.
   */
  get canCaptureTotp() {
    return (
      !!this.totpCaptureService?.canCaptureTotp(window) &&
      this.loginDetailsForm.controls.totp.enabled
    );
  }

  private datePipe = inject(DatePipe);

  /**
   * A local reference to the Fido2 credentials for an existing login being edited.
   * These cannot be created in the form and thus have no form control.
   * @private
   */
  private existingFido2Credentials?: Fido2CredentialView[];

  private destroyRef = inject(DestroyRef);

  private readonly accountService = inject(AccountService);
  private readonly billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private readonly configService = inject(ConfigService);

  private readonly upgradePathsFlag$ = this.configService.getFeatureFlag$(
    FeatureFlag.PM42214_FeatureBasedUpgradePaths,
  );

  protected readonly upgradePathsFlagOn = toSignal(this.upgradePathsFlag$, {
    initialValue: false,
  });

  protected readonly account = toSignal(
    this.upgradePathsFlag$.pipe(
      switchMap((flagOn) => {
        if (!flagOn) {
          return of(null);
        }
        return this.accountService.activeAccount$.pipe(
          getUserId,
          switchMap((userId) =>
            this.billingAccountProfileStateService
              .hasPremiumFromAnySource$(userId)
              .pipe(map((hasPremium) => ({ userId, hasPremium }))),
          ),
        );
      }),
    ),
    { initialValue: null },
  );

  private readonly totpInput = viewChild<ElementRef<HTMLInputElement>>("totpInput");

  protected readonly totpCipher = toSignal(
    this.loginDetailsForm.controls.totp.valueChanges.pipe(
      startWith(this.loginDetailsForm.controls.totp.value),
      map((totp) => totp?.trim() ?? ""),
      distinctUntilChanged(),
      tap(() => (this.totpCode = null)),
      map((totp) => {
        const cipher = new CipherView();
        cipher.login = Object.assign(new LoginView(), { totp });
        return cipher;
      }),
    ),
  );

  protected totpCode: Pick<TotpInfo, "totpCode" | "totpCodeFormatted"> | null = null;

  protected readonly ownerOrganizationId = toSignal(this.cipherFormContainer.organizationId$, {
    initialValue: null,
  });

  protected get hasTotpKey(): boolean {
    return !!this.loginDetailsForm.controls.totp.value;
  }

  protected get showCaptureTotpButton(): boolean {
    return this.canCaptureTotp && !(this.upgradePathsFlagOn() && this.hasTotpKey);
  }

  protected get showDeleteTotpButton(): boolean {
    return (
      this.upgradePathsFlagOn() && this.hasTotpKey && this.loginDetailsForm.controls.totp.enabled
    );
  }

  protected get showTotpCode(): boolean {
    return !!this.account()?.hasPremium;
  }

  get hasPasskey(): boolean {
    return this.existingFido2Credentials != null && this.existingFido2Credentials.length > 0;
  }

  get fido2CredentialCreationDateValue(): string {
    const dateCreated = this.i18nService.t("dateCreated");
    const creationDate = this.datePipe.transform(
      this.existingFido2Credentials?.[0]?.creationDate,
      "short",
    );
    return `${dateCreated} ${creationDate}`;
  }

  get viewHiddenFields() {
    if (this.cipherFormContainer.originalCipherView) {
      return this.cipherFormContainer.originalCipherView.viewPassword;
    }
    return true;
  }

  get initialValues() {
    return this.cipherFormContainer.config.initialValues;
  }

  constructor(
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private generationService: CipherFormGenerationService,
    private auditService: AuditService,
    private toastService: ToastService,
    private eventCollectionService: EventCollectionService,
    private dialogService: DialogService,
    @Optional() private totpCaptureService?: TotpCaptureService,
  ) {
    this.cipherFormContainer.registerChildForm("loginDetails", this.loginDetailsForm);

    this.loginDetailsForm.valueChanges
      .pipe(
        takeUntilDestroyed(),
        // getRawValue() is used as fields can be disabled when passwords are hidden
        map(() => this.loginDetailsForm.getRawValue()),
      )
      .subscribe((value) => {
        this.cipherFormContainer.patchCipher((cipher) => {
          Object.assign(cipher.login, {
            username: value.username,
            password: value.password,
            totp: value.totp?.trim(),
          } as LoginView);

          return cipher;
        });
      });
  }

  ngOnInit() {
    const prefillCipher = this.cipherFormContainer.getInitialCipherView();

    if (prefillCipher) {
      this.initFromExistingCipher(prefillCipher.login);
    } else {
      this.initNewCipher();
    }

    if (this.cipherFormContainer.config.mode === "partial-edit") {
      this.loginDetailsForm.disable();
    }

    // If the form is enabled, ensure to disable password or TOTP
    // for hidden password users
    this.cipherFormContainer.formStatusChange$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        if (status === "enabled") {
          if (!this.viewHiddenFields) {
            this.loginDetailsForm.controls.password.disable();
            this.loginDetailsForm.controls.totp.disable();
          }
        }
      });
  }

  private initFromExistingCipher(existingLogin: LoginView) {
    this.loginDetailsForm.patchValue({
      username: this.initialValues?.username ?? existingLogin.username,
      password: this.initialValues?.password ?? existingLogin.password,
      totp: existingLogin.totp,
    });

    if (this.cipherFormContainer.config.mode != "clone") {
      this.existingFido2Credentials = existingLogin.fido2Credentials;
    }

    if (!this.viewHiddenFields) {
      this.loginDetailsForm.controls.password.disable();
      this.loginDetailsForm.controls.totp.disable();
    }
  }

  private initNewCipher() {
    this.loginDetailsForm.patchValue({
      username: this.initialValues?.username || "",
      password: this.initialValues?.password || "",
    });
  }

  /** Logs the giving event when in edit mode */
  logVisibleEvent = async (passwordVisible: boolean, event: EventType) => {
    const { mode, originalCipher } = this.cipherFormContainer.config;

    const isEdit = ["edit", "partial-edit"].includes(mode);

    if (!passwordVisible || !isEdit || !originalCipher) {
      return;
    }

    await this.eventCollectionService.collect(
      event,
      originalCipher.id,
      false,
      originalCipher.organizationId,
    );
  };

  captureTotp = async () => {
    if (!this.canCaptureTotp) {
      return;
    }
    try {
      const totp = await this.totpCaptureService.captureTotpSecret();
      if (totp) {
        this.loginDetailsForm.controls.totp.patchValue(totp);
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("totpCaptureSuccess"),
        });
      }
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("totpCaptureError"),
      });
    }
  };

  protected setTotpCode(totpCode: Pick<TotpInfo, "totpCode" | "totpCodeFormatted">) {
    this.totpCode = totpCode;
  }

  protected deleteTotp = async () => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteAuthenticatorKey" },
      content: { key: "deleteAuthenticatorKeyConfirmation" },
      type: "danger",
      icon: "bwi-exclamation-triangle",
      acceptButtonText: { key: "delete" },
    });

    if (confirmed) {
      this.loginDetailsForm.controls.totp.setValue("");
      this.totpCode = null;
      this.totpInput()?.nativeElement.focus();
    }
  };

  removePasskey = async () => {
    const dialogRef = DeletePasskeyDialogComponent.open(this.dialogService);
    const result = await firstValueFrom(dialogRef.closed);

    if (result !== DeletePasskeyDialogResult.Delete) {
      return;
    }

    // Fido2Credentials do not have a form control, so update directly
    this.existingFido2Credentials = null;
    this.cipherFormContainer.patchCipher((cipher) => {
      cipher.login.fido2Credentials = null;
      return cipher;
    });
  };

  /**
   * Generate a new password and update the form.
   * TODO: Browser extension needs a means to cache the current form so values are not lost upon navigating to the generator.
   */
  generatePassword = async () => {
    const newPassword = await this.generationService.generatePassword();

    if (newPassword) {
      this.loginDetailsForm.controls.password.patchValue(newPassword);
      this.newPasswordGenerated = true;
    }
  };

  /**
   * Generate a new username and update the form.
   * TODO: Browser extension needs a means to cache the current form so values are not lost upon navigating to the generator.
   */
  generateUsername = async () => {
    const newUsername = await this.generationService.generateUsername(
      this.cipherFormContainer.website,
    );
    if (newUsername) {
      this.loginDetailsForm.controls.username.patchValue(newUsername);
    }
  };

  /**
   * Checks if the password has been exposed in a data breach using the AuditService.
   */
  checkPassword = async () => {
    const password = this.loginDetailsForm.controls.password.value;

    if (password == null || password === "") {
      return;
    }

    const matches = await this.auditService.passwordLeaked(password);

    if (matches > 0) {
      this.toastService.showToast({
        variant: "warning",
        title: null,
        message: this.i18nService.t("passwordExposed", matches.toString()),
      });
    } else {
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("passwordSafe"),
      });
    }
  };
}
