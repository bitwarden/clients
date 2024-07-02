import { CommonModule } from "@angular/common";
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { ReactiveFormsModule, UntypedFormBuilder, Validators } from "@angular/forms";
import { map, merge, Observable, startWith, Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PasswordStrengthV2Component } from "@bitwarden/angular/tools/password-strength/password-strength-v2.component";
import { UserVerificationDialogComponent } from "@bitwarden/auth/angular";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { EventType } from "@bitwarden/common/enums";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncryptedExportType } from "@bitwarden/common/tools/enums/encrypted-export-type.enum";
import {
  AsyncActionsModule,
  BitSubmitDirective,
  ButtonModule,
  CalloutModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  RadioButtonModule,
  SelectModule,
  ToastService,
} from "@bitwarden/components";
import { VaultExportServiceAbstraction } from "@bitwarden/vault-export-core";

import { ExportScopeCalloutComponent } from "./export-scope-callout.component";

@Component({
  selector: "tools-export",
  templateUrl: "export.component.html",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    IconButtonModule,
    SelectModule,
    CalloutModule,
    RadioButtonModule,
    ExportScopeCalloutComponent,
    UserVerificationDialogComponent,
    PasswordStrengthV2Component,
  ],
})
export class ExportComponent implements OnInit, OnDestroy {
  private _organizationId: string;

  get organizationId(): string {
    return this._organizationId;
  }

  /**
   * Enables the hosting control to pass in an organizationId
   * If a organizationId is provided, the organization selection is disabled.
   */
  @Input() set organizationId(value: string) {
    this._organizationId = value;
    this.organizationService
      .get$(this._organizationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((organization) => {
        this._organizationId = organization?.id;
      });
  }

  /**
   * The hosting control also needs a bitSubmitDirective (on the Submit button) which calls this components {@link submit}-method.
   * This components formState (loading/disabled) is emitted back up to the hosting component so for example the Submit button can be enabled/disabled and show loading state.
   */
  @ViewChild(BitSubmitDirective)
  private bitSubmit: BitSubmitDirective;

  /**
   * Emits true when the BitSubmitDirective({@link bitSubmit} is executing {@link submit} and false when execution has completed.
   * Example: Used to show the loading state of the submit button present on the hosting component
   * */
  @Output()
  formLoading = new EventEmitter<boolean>();

  /**
   * Emits true when this form gets disabled and false when enabled.
   * Example: Used to disable the submit button, which is present on the hosting component
   * */
  @Output()
  formDisabled = new EventEmitter<boolean>();

  /**
   * Emits when the creation and download of the export-file have succeeded
   * - Emits an null/empty string when exporting from an individual vault
   * - Emits the organizationId when exporting from an organizationl vault
   * */
  @Output()
  onSuccessfulExport = new EventEmitter<string>();

  @ViewChild(PasswordStrengthV2Component) passwordStrengthComponent: PasswordStrengthV2Component;

  encryptedExportType = EncryptedExportType;
  protected showFilePassword: boolean;

  filePasswordValue: string = null;
  private _disabledByPolicy = false;

  organizations$: Observable<Organization[]>;

  protected get disabledByPolicy(): boolean {
    return this._disabledByPolicy;
  }

  exportForm = this.formBuilder.group({
    vaultSelector: [
      "myVault",
      {
        nonNullable: true,
        validators: [Validators.required],
      },
    ],
    format: ["json", Validators.required],
    secret: [""],
    filePassword: ["", Validators.required],
    confirmFilePassword: ["", Validators.required],
    fileEncryptionType: [EncryptedExportType.AccountEncrypted],
  });

  formatOptions = [
    { name: ".json", value: "json" },
    { name: ".csv", value: "csv" },
    { name: ".json (Encrypted)", value: "encrypted_json" },
  ];

  private destroy$ = new Subject<void>();
  private onlyManagedCollections = true;

  constructor(
    protected i18nService: I18nService,
    protected toastService: ToastService,
    protected exportService: VaultExportServiceAbstraction,
    protected eventCollectionService: EventCollectionService,
    private policyService: PolicyService,
    private logService: LogService,
    private formBuilder: UntypedFormBuilder,
    protected fileDownloadService: FileDownloadService,
    protected dialogService: DialogService,
    protected organizationService: OrganizationService,
  ) {}

  async ngOnInit() {
    // Setup subscription to emit when this form is enabled/disabled
    this.exportForm.statusChanges.pipe(takeUntil(this.destroy$)).subscribe((c) => {
      this.formDisabled.emit(c === "DISABLED");
    });

    this.policyService
      .policyAppliesToActiveUser$(PolicyType.DisablePersonalVaultExport)
      .pipe(takeUntil(this.destroy$))
      .subscribe((policyAppliesToActiveUser) => {
        this._disabledByPolicy = policyAppliesToActiveUser;
        if (this.disabledByPolicy) {
          this.exportForm.disable();
        }
      });

    merge(
      this.exportForm.get("format").valueChanges,
      this.exportForm.get("fileEncryptionType").valueChanges,
    )
      .pipe(startWith(0), takeUntil(this.destroy$))
      .subscribe(() => this.adjustValidators());

    if (this.organizationId) {
      this.organizations$ = this.organizationService.memberOrganizations$.pipe(
        map((orgs) => orgs.filter((org) => org.id == this.organizationId)),
      );
      this.exportForm.controls.vaultSelector.patchValue(this.organizationId);
      this.exportForm.controls.vaultSelector.disable();

      this.onlyManagedCollections = false;
      return;
    }

    this.organizations$ = this.organizationService.memberOrganizations$.pipe(
      map((orgs) => orgs.sort(Utils.getSortFunction(this.i18nService, "name"))),
    );

    this.exportForm.controls.vaultSelector.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        this.organizationId = value != "myVault" ? value : undefined;
      });

    this.exportForm.controls.vaultSelector.setValue("myVault");
  }

  ngAfterViewInit(): void {
    this.bitSubmit.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
      this.formLoading.emit(loading);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
  }

  get encryptedFormat() {
    return this.format === "encrypted_json";
  }

  get isFileEncryptedExport() {
    return (
      this.format === "encrypted_json" &&
      this.fileEncryptionType === EncryptedExportType.FileEncrypted
    );
  }

  get isAccountEncryptedExport() {
    return (
      this.format === "encrypted_json" &&
      this.fileEncryptionType === EncryptedExportType.AccountEncrypted
    );
  }

  protected async doExport() {
    try {
      const data = await this.getExportData();
      this.downloadFile(data);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("exportSuccess"),
      });
      this.onSuccessfulExport.emit(this.organizationId);
      await this.collectEvent();
      this.exportForm.get("secret").setValue("");
      this.exportForm.clearValidators();
    } catch (e) {
      this.logService.error(e);
    }
  }

  submit = async () => {
    if (this.isFileEncryptedExport && this.filePassword != this.confirmFilePassword) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("filePasswordAndConfirmFilePasswordDoNotMatch"),
      });
      return;
    }

    this.exportForm.markAllAsTouched();
    if (this.exportForm.invalid) {
      return;
    }

    if (this.disabledByPolicy) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("personalVaultExportPolicyInEffect"),
      });
      return;
    }

    const userVerified = await this.verifyUser();
    if (!userVerified) {
      return;
    }

    await this.doExport();
  };

  private async verifyUser(): Promise<boolean> {
    let confirmDescription = "exportWarningDesc";
    if (this.isFileEncryptedExport) {
      confirmDescription = "fileEncryptedExportWarningDesc";
    } else if (this.isAccountEncryptedExport) {
      confirmDescription = "encExportKeyWarningDesc";
    }

    const result = await UserVerificationDialogComponent.open(this.dialogService, {
      title: "confirmVaultExport",
      bodyText: confirmDescription,
      confirmButtonOptions: {
        text: "exportVault",
        type: "primary",
      },
    });

    // Handle the result of the dialog based on user action and verification success
    if (result.userAction === "cancel") {
      // User cancelled the dialog
      return false;
    }

    // User confirmed the dialog so check verification success
    if (!result.verificationSuccess) {
      if (result.noAvailableClientVerificationMethods) {
        // No client-side verification methods are available
        // Could send user to configure a verification method like PIN or biometrics
      }
      return false;
    }
    return true;
  }

  protected async getExportData(): Promise<string> {
    return Utils.isNullOrWhitespace(this.organizationId)
      ? this.exportService.getExport(this.format, this.filePassword)
      : this.exportService.getOrganizationExport(
          this.organizationId,
          this.format,
          this.filePassword,
          this.onlyManagedCollections,
        );
  }

  protected getFileName(prefix?: string) {
    if (this.organizationId) {
      prefix = "org";
    }

    let extension = this.format;
    if (this.format === "encrypted_json") {
      if (prefix == null) {
        prefix = "encrypted";
      } else {
        prefix = "encrypted_" + prefix;
      }
      extension = "json";
    }
    return this.exportService.getFileName(prefix, extension);
  }

  protected async collectEvent(): Promise<void> {
    if (this.organizationId) {
      return await this.eventCollectionService.collect(
        EventType.Organization_ClientExportedVault,
        null,
        false,
        this.organizationId,
      );
    }
    return await this.eventCollectionService.collect(EventType.User_ClientExportedVault);
  }

  get format() {
    return this.exportForm.get("format").value;
  }

  get filePassword() {
    return this.exportForm.get("filePassword").value;
  }

  get confirmFilePassword() {
    return this.exportForm.get("confirmFilePassword").value;
  }

  get fileEncryptionType() {
    return this.exportForm.get("fileEncryptionType").value;
  }

  adjustValidators() {
    this.exportForm.get("confirmFilePassword").reset();
    this.exportForm.get("filePassword").reset();

    if (this.encryptedFormat && this.fileEncryptionType == EncryptedExportType.FileEncrypted) {
      this.exportForm.controls.filePassword.enable();
      this.exportForm.controls.confirmFilePassword.enable();
    } else {
      this.exportForm.controls.filePassword.disable();
      this.exportForm.controls.confirmFilePassword.disable();
    }
  }

  private downloadFile(csv: string): void {
    const fileName = this.getFileName();
    this.fileDownloadService.download({
      fileName: fileName,
      blobData: csv,
      blobOptions: { type: "text/plain" },
    });
  }
}
