import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from "@angular/core";
import { ReactiveFormsModule, UntypedFormBuilder, Validators } from "@angular/forms";
import { map, merge, Observable, startWith, Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PasswordStrengthComponent } from "@bitwarden/angular/tools/password-strength/password-strength.component";
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
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
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
  ],
})
export class ExportComponent implements OnInit, OnDestroy {
  @ViewChild(BitSubmitDirective)
  private bitSubmit: BitSubmitDirective;

  /**
   * Passes the forms loading state out to the hosting component
   * Example: Used to show the loading state of other controls present on the hosting component
   * */
  @Output()
  formLoading = new EventEmitter<boolean>();

  /**
   * Passes the forms disabled state out to the hosting component
   * Example: Used to disable the submit button, which is present on the hosting component
   * */
  @Output()
  formDisabled = new EventEmitter<boolean>();

  /**
   * Emits when the creation and download of the export-file have succeeded
   * */
  @Output()
  onSuccessfulExport = new EventEmitter<string>();

  @Output() onSaved = new EventEmitter();
  @ViewChild(PasswordStrengthComponent) passwordStrengthComponent: PasswordStrengthComponent;

  encryptedExportType = EncryptedExportType;
  protected showFilePassword: boolean;

  filePasswordValue: string = null;
  private _disabledByPolicy = false;

  protected organizationId: string = null;
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

  constructor(
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
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
      return;
    }

    this.organizations$ = this.organizationService.memberOrganizations$.pipe(
      map((orgs) =>
        orgs
          .filter((org) => org.flexibleCollections)
          .sort(Utils.getSortFunction(this.i18nService, "name")),
      ),
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

    this.bitSubmit.disabled$.pipe(takeUntil(this.destroy$)).subscribe((disabled) => {
      this.formDisabled.emit(disabled);
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
      this.saved();
      await this.collectEvent();
      this.exportForm.get("secret").setValue("");
      this.exportForm.clearValidators();
    } catch (e) {
      this.logService.error(e);
    }
  }

  submit = async () => {
    if (this.isFileEncryptedExport && this.filePassword != this.confirmFilePassword) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("filePasswordAndConfirmFilePasswordDoNotMatch"),
      );
      return;
    }

    this.exportForm.markAllAsTouched();
    if (this.exportForm.invalid) {
      return;
    }

    if (this.disabledByPolicy) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("personalVaultExportPolicyInEffect"),
      );
      return;
    }

    const userVerified = await this.verifyUser();
    if (!userVerified) {
      return;
    }

    await this.doExport();
  };

  protected saved() {
    this.onSaved.emit();
    this.onSuccessfulExport.emit(this.organizationId);
  }

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
          true,
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
