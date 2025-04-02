import { DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from "@angular/forms";
import { Subject, firstValueFrom, filter, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  EnvironmentService,
  Region,
  Urls,
} from "@bitwarden/common/platform/abstractions/environment.service";
import {
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

/**
 * Dialog for configuring self-hosted environment settings.
 */
@Component({
  standalone: true,
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

    return (await firstValueFrom(dialogRef.closed)) ?? false;
  }

  formGroup = this.formBuilder.group(
    {
      baseUrl: [""],
      webVaultUrl: [""],
      apiUrl: [""],
      identityUrl: [""],
      iconsUrl: [""],
      notificationsUrl: [""],
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

  async ngOnInit() {
    this.environmentService.environment$
      .pipe(
        filter((env) => {
          const region = env.getRegion();
          return region === Region.SelfHosted;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((env) => {
        const urls = env.getUrls();
        this.formGroup.patchValue({
          baseUrl: urls.base || "",
          webVaultUrl: urls.webVault || "",
          apiUrl: urls.api || "",
          identityUrl: urls.identity || "",
          iconsUrl: urls.icons || "",
          notificationsUrl: urls.notifications || "",
        });
      });

    // Check if all form fields are empty
    const allFieldsEmpty =
      !this.baseUrl.value &&
      !this.webVaultUrl.value &&
      !this.apiUrl.value &&
      !this.identityUrl.value &&
      !this.iconsUrl.value &&
      !this.notificationsUrl.value;

    // If all fields are empty, set the environment to the managed environment as a fallback
    if (allFieldsEmpty) {
      const managedEnvironment = await this.environmentService.getManagedEnvironment<Urls>();
      if (managedEnvironment) {
        await this.environmentService.setEnvironment(Region.SelfHosted, managedEnvironment);
      }
    }
  }

  submit = async () => {
    this.showErrorSummary = false;

    if (this.formGroup.invalid) {
      this.showErrorSummary = true;
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
