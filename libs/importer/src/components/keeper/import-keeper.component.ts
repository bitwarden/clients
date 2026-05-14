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
import { toSignal } from "@angular/core/rxjs-interop";
import {
  ControlContainer,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  CalloutModule,
  FormFieldModule,
  IconButtonModule,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import { KeeperRegion } from "../../importers/keeper/access";
import { ImportResult } from "../../models";

import { KeeperDirectImportService } from "./keeper-direct-import.service";

export type KeeperImportMethod = "direct" | "csv" | "json";

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
        this.directSupported ? "direct" : "csv",
        { updateOn: "change" },
      ),
      email: ["", [Validators.email]],
      region: [KeeperRegion.Us],
    },
    {
      updateOn: "submit",
    },
  );

  protected readonly method = toSignal(this.formGroup.controls.method.valueChanges, {
    initialValue: this.formGroup.controls.method.value as KeeperImportMethod,
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
      const importResult = await this.keeperDirectImportService.handleImport(
        email.value!,
        this.formGroup.controls.region.value as KeeperRegion,
        organizationId,
      );
      this.importCompleted.emit(importResult);
    } catch (error) {
      this.logService.error(`Keeper importer error: ${error}`);
      email.setErrors({
        errors: {
          message: this.i18nService.t(this.getValidationErrorI18nKey(error)),
        },
      });
    } finally {
      this.importing.set(false);
    }
  }

  private getValidationErrorI18nKey(error: unknown): string {
    const message = typeof error === "string" ? error : (error as Error)?.message;
    switch (message) {
      case "Authentication cancelled":
      case "Authentication cancelled by user":
      case "Device approval cancelled":
      case "Device approval cancelled by user":
      case "Two-factor authentication cancelled by user":
      case "SSO authentication cancelled by user":
      case "MFA cancelled":
        return "multifactorAuthenticationCancelled";
      case "No data found":
      case "Vault has not opened any accounts.":
        return "noKeeperDataFound";
      case "Invalid username":
      case "Invalid password":
      case "Invalid credentials":
        return "incorrectUsernameOrPassword";
      case "MFA failed":
      case "Device approval failed":
        return "multifactorAuthenticationFailed";
      default:
        return "errorOccurred";
    }
  }
}
