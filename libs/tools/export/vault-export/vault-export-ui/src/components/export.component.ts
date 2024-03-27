import { Directive, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from "@angular/core";
import { UntypedFormBuilder, Validators } from "@angular/forms";
import { map, merge, Observable, startWith, Subject, takeUntil } from "rxjs";

import { PasswordStrengthComponent } from "@bitwarden/angular/tools/password-strength/password-strength.component";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { EventType } from "@bitwarden/common/enums";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncryptedExportType } from "@bitwarden/common/tools/enums/encrypted-export-type.enum";
import { DialogService } from "@bitwarden/components";
import { VaultExportServiceAbstraction } from "@bitwarden/vault-export-core";

@Directive()
export class ExportComponent implements OnInit, OnDestroy {
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
    private userVerificationService: UserVerificationService,
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
      .pipe(takeUntil(this.destroy$))
      .pipe(startWith(0))
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

  async submit() {
    if (this.disabledByPolicy) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("personalVaultExportPolicyInEffect"),
      );
      return;
    }

    const acceptedWarning = await this.warningDialog();
    if (!acceptedWarning) {
      return;
    }
    const secret = this.exportForm.get("secret").value;

    try {
      await this.userVerificationService.verifyUser(secret);
    } catch (e) {
      this.platformUtilsService.showToast("error", this.i18nService.t("errorOccurred"), e.message);
      return;
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.doExport();
  }

  async warningDialog() {
    if (this.encryptedFormat) {
      return await this.dialogService.openSimpleDialog({
        title: { key: "confirmVaultExport" },
        content:
          this.i18nService.t("encExportKeyWarningDesc") +
          " " +
          this.i18nService.t("encExportAccountWarningDesc"),
        acceptButtonText: { key: "exportVault" },
        type: "warning",
      });
    } else {
      return await this.dialogService.openSimpleDialog({
        title: { key: "confirmVaultExport" },
        content: { key: "exportWarningDesc" },
        acceptButtonText: { key: "exportVault" },
        type: "warning",
      });
    }
  }

  protected saved() {
    this.onSaved.emit();
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
    await this.eventCollectionService.collect(EventType.User_ClientExportedVault);
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
