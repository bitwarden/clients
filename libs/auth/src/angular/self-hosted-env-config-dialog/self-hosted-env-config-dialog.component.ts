import { CommonModule } from "@angular/common";
import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from "@angular/forms";
import { Subject, firstValueFrom, take, filter, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  EnvironmentService,
  Region,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  LinkModule,
  TypographyModule,
} from "@bitwarden/components";

/**
 * Validator for self-hosted environment settings form.
 * It enforces that at least one URL is provided.
 */
function selfHostedEnvSettingsFormValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const formGroup = control as FormGroup;
    const baseUrl = formGroup.get("baseUrl")?.value;
    const webVaultUrl = formGroup.get("webVaultUrl")?.value;
    const apiUrl = formGroup.get("apiUrl")?.value;
    const identityUrl = formGroup.get("identityUrl")?.value;
    const iconsUrl = formGroup.get("iconsUrl")?.value;
    const notificationsUrl = formGroup.get("notificationsUrl")?.value;

    if (baseUrl || webVaultUrl || apiUrl || identityUrl || iconsUrl || notificationsUrl) {
      return null; // valid
    } else {
      return { atLeastOneUrlIsRequired: true }; // invalid
    }
  };
}

function onlyHttpsValidator(): ValidatorFn {
  const i18nService = inject(I18nService);
  const platformUtilsService = inject(PlatformUtilsService);

  return (control: AbstractControl): ValidationErrors | null => {
    const url = control.value as string;

    if (url && !url.startsWith("https://") && !platformUtilsService.isDev()) {
      return {
        onlyHttpsAllowed: {
          message: i18nService.t("selfHostedEnvMustUseHttps"),
        },
      }; // invalid
    }

    return null; // valid
  };
}

/**
 * Dialog for configuring self-hosted environment settings.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "self-hosted-env-config-dialog",
  templateUrl: "self-hosted-env-config-dialog.component.html",
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
  ],
})
export class SelfHostedEnvConfigDialogComponent implements OnInit, OnDestroy {
  /**
   * Opens the dialog.
   * @param dialogService - Dialog service.
   * @returns Promise that resolves to true if the dialog was closed with a successful result, false otherwise.
   */
  static async open(dialogService: DialogService): Promise<boolean> {
    const dialogRef = dialogService.open<boolean>(SelfHostedEnvConfigDialogComponent, {
      disableClose: false,
    });

    const dialogResult = await firstValueFrom(dialogRef.closed);

    return dialogResult ?? false;
  }

  formGroup = this.formBuilder.group(
    {
      baseUrl: ["", [onlyHttpsValidator()]],
      webVaultUrl: ["", [onlyHttpsValidator()]],
      apiUrl: ["", [onlyHttpsValidator()]],
      identityUrl: ["", [onlyHttpsValidator()]],
      iconsUrl: ["", [onlyHttpsValidator()]],
      notificationsUrl: ["", [onlyHttpsValidator()]],
    },
    { validators: selfHostedEnvSettingsFormValidator() },
  );

  get baseUrl(): FormControl {
    return this.formGroup.get("baseUrl") as FormControl;
  }

  get webVaultUrl(): FormControl {
    return this.formGroup.get("webVaultUrl") as FormControl;
  }

  get apiUrl(): FormControl {
    return this.formGroup.get("apiUrl") as FormControl;
  }

  get identityUrl(): FormControl {
    return this.formGroup.get("identityUrl") as FormControl;
  }

  get iconsUrl(): FormControl {
    return this.formGroup.get("iconsUrl") as FormControl;
  }

  get notificationsUrl(): FormControl {
    return this.formGroup.get("notificationsUrl") as FormControl;
  }

  showCustomEnv = false;
  showErrorSummary = false;

  private destroy$ = new Subject<void>();

  constructor(
    private dialogRef: DialogRef<boolean>,
    private formBuilder: FormBuilder,
    private environmentService: EnvironmentService,
  ) {}

  ngOnInit() {
    /**
     * Populate the form with the current self-hosted environment settings.
     */
    this.environmentService.environment$
      .pipe(
        take(1),
        filter((env) => {
          const region = env.getRegion();
          return region === Region.SelfHosted;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (env) => {
          const urls = env.getUrls();
          this.formGroup.patchValue({
            baseUrl: urls.base || "",
            webVaultUrl: urls.webVault || "",
            apiUrl: urls.api || "",
            identityUrl: urls.identity || "",
            iconsUrl: urls.icons || "",
            notificationsUrl: urls.notifications || "",
          });
        },
      });
  }
  submit = async () => {
    this.formGroup.markAllAsTouched();
    this.showErrorSummary = false;

    if (this.formGroup.invalid) {
      this.showErrorSummary = Boolean(this.formGroup.errors?.["atLeastOneUrlIsRequired"]);
      return;
    }

    await this.environmentService.setEnvironment(Region.SelfHosted, {
      base: this.baseUrl.value,
      api: this.apiUrl.value,
      identity: this.identityUrl.value,
      webVault: this.webVaultUrl.value,
      icons: this.iconsUrl.value,
      notifications: this.notificationsUrl.value,
    });

    this.dialogRef.close(true);
  };

  async cancel() {
    this.dialogRef.close(false);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
