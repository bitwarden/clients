import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
  ControlContainer,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { lastValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  CalloutModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import { KeeperAuthError, KeeperAuthErrorCode, KeeperRegion } from "../../importers/keeper/access";
import { ImportResult } from "../../models";
import { ImportRecordError } from "../../models/import-record-error";

import { KeeperDirectImportService } from "./keeper-direct-import.service";
import { keeperImportGate, shouldSubmitAfterDialog } from "./keeper-import-gate";
import {
  PartialImportDialogComponent,
  PartialImportDialogData,
} from "./partial-import-dialog.component";

export type KeeperImportMethod = "direct" | "csv" | "json";

export function defaultKeeperImportMethod(
  platformUtilsService: PlatformUtilsService,
): KeeperImportMethod {
  const client = platformUtilsService.getClientType();
  return client === ClientType.Desktop || client === ClientType.Browser ? "direct" : "csv";
}

@Component({
  selector: "import-keeper",
  templateUrl: "import-keeper.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    CalloutModule,
    TypographyModule,
    FormFieldModule,
    ReactiveFormsModule,
    IconButtonModule,
    SelectModule,
  ],
})
export class ImportKeeperComponent implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly controlContainer = inject(ControlContainer);
  private readonly logService = inject(LogService);
  private readonly keeperDirectImportService = inject(KeeperDirectImportService);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly dialogService = inject(DialogService);

  private readonly _parentFormGroup = signal<FormGroup | null>(null);

  // Direct import requires platform APIs (deep-linking, native window) that
  // only exist on desktop and the browser extension. CSV/Json work everywhere.
  private readonly directSupported =
    this.platformUtilsService.getClientType() === ClientType.Desktop ||
    this.platformUtilsService.getClientType() === ClientType.Browser;

  protected readonly methods: { value: KeeperImportMethod; label: string }[] = [
    ...(this.directSupported
      ? [{ value: "direct" as KeeperImportMethod, label: "directImporter" }]
      : []),
    { value: "csv", label: "csv" },
    { value: "json", label: "json" },
  ];

  protected readonly regions = [
    { value: KeeperRegion.Us, label: "US" },
    { value: KeeperRegion.Eu, label: "EU" },
    { value: KeeperRegion.Au, label: "AU" },
    { value: KeeperRegion.Ca, label: "CA" },
    { value: KeeperRegion.Jp, label: "JP" },
    { value: KeeperRegion.UsGov, label: "US (GOV)" },
  ];

  protected readonly formGroup = this.formBuilder.group(
    {
      // Method must update on change so the template can react before submit.
      method: this.formBuilder.nonNullable.control<KeeperImportMethod>(
        defaultKeeperImportMethod(this.platformUtilsService),
        { updateOn: "change" },
      ),
      email: this.formBuilder.control({ value: "", disabled: !this.directSupported }, [
        Validators.required,
        Validators.email,
      ]),
      region: [KeeperRegion.Us],
    },
    {
      updateOn: "submit",
    },
  );

  protected readonly method = toSignal(this.formGroup.controls.method.valueChanges, {
    initialValue: this.formGroup.controls.method.value as KeeperImportMethod,
  });

  // Email is only relevant in direct mode. Disabling the control in csv/json
  // mode keeps it out of the form's value and validity calculation.
  private readonly toggleEmailEnabled = this.formGroup.controls.method.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe((method) => {
      const email = this.formGroup.controls.email;
      if (method === "direct") {
        email.enable();
      } else {
        email.disable();
      }
    });

  private readonly importing = signal(false);
  protected readonly emailHint = computed(() =>
    this.i18nService.t(this.importing() ? "importingYourAccount" : "keeperEmailHint"),
  );

  readonly importCompleted = output<ImportResult>();

  ngOnInit(): void {
    this._parentFormGroup.set(this.controlContainer.control as FormGroup);
    this._parentFormGroup()!.addControl("keeperOptions", this.formGroup);
  }

  ngOnDestroy(): void {
    this._parentFormGroup()?.removeControl("keeperOptions");
  }

  /**
   * Logs into Keeper and emits the result. The parent invokes this from its
   * submit handler when the direct method is selected; csv/json fall through
   * to the parent's file-based path.
   */
  async submitDirect(organizationId: OrganizationId | undefined): Promise<void> {
    if (this.formGroup.controls.method.value !== "direct") {
      return;
    }

    const email = this.formGroup.controls.email;
    if (email.invalid) {
      return;
    }

    this.importing.set(true);
    email.setErrors(null);
    try {
      const { result, errors } = await this.keeperDirectImportService.handleImport(
        email.value!,
        this.formGroup.controls.region.value as KeeperRegion,
        organizationId,
      );
      // Stop the "importing" hint before any confirmation dialog is shown.
      this.importing.set(false);

      if (await this.confirmPartialImport(result, errors)) {
        this.importCompleted.emit(result);
      }
    } catch (error) {
      this.logService.error(`Keeper importer error: ${error}`);
      email.setErrors({
        errors: {
          message: this.i18nService.t(this.getValidationErrorI18nKey(error)),
        },
      });
      email.markAsTouched();
    } finally {
      this.importing.set(false);
    }
  }

  /**
   * When the import produced per-record errors, show the partial-import dialog and let the user
   * decide. Returns whether the (clean) result should be handed off to the import pipeline. With no
   * errors, proceeds without a dialog.
   */
  private async confirmPartialImport(
    result: ImportResult,
    errors: ImportRecordError[],
  ): Promise<boolean> {
    const { needsConfirmation, canImport } = keeperImportGate(result, errors);
    if (!needsConfirmation) {
      return true;
    }

    const dialog = this.dialogService.open<boolean, PartialImportDialogData>(
      PartialImportDialogComponent,
      { data: { errors, canImport } },
    );
    const dialogResult = await lastValueFrom(dialog.closed);
    return shouldSubmitAfterDialog(canImport, dialogResult);
  }

  private getValidationErrorI18nKey(error: unknown): string {
    if (error instanceof KeeperAuthError) {
      switch (error.code) {
        case KeeperAuthErrorCode.Cancelled:
          return "multifactorAuthenticationCancelled";
        case KeeperAuthErrorCode.MfaFailed:
          return "multifactorAuthenticationFailed";
        case KeeperAuthErrorCode.UnsupportedTwoFactorMethod:
          return "keeperUnsupported2faMethod";
        case KeeperAuthErrorCode.SocketError:
          return "keeperConnectionError";
      }
    }
    return "errorOccurred";
  }
}
