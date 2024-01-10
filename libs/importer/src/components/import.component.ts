import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import * as JSZip from "jszip";
import { concat, Observable, Subject, lastValueFrom, combineLatest, firstValueFrom } from "rxjs";
import { filter, map, takeUntil } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  canAccessImportExport,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ClientType } from "@bitwarden/common/enums";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
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

import { ImportOption, ImportResult, ImportType } from "../models";
import {
  ImportApiService,
  ImportApiServiceAbstraction,
  ImportService,
  ImportServiceAbstraction,
} from "../services";

import {
  FilePasswordPromptComponent,
  ImportErrorDialogComponent,
  ImportSuccessDialogComponent,
} from "./dialog";
import { ImportLastPassComponent } from "./lastpass";

@Component({
  selector: "tools-import",
  templateUrl: "import.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    IconButtonModule,
    SelectModule,
    CalloutModule,
    ReactiveFormsModule,
    ImportLastPassComponent,
    RadioButtonModule,
  ],
  providers: [
    {
      provide: ImportApiServiceAbstraction,
      useClass: ImportApiService,
      deps: [ApiService],
    },
    {
      provide: ImportServiceAbstraction,
      useClass: ImportService,
      deps: [
        CipherService,
        FolderService,
        ImportApiServiceAbstraction,
        I18nService,
        CollectionService,
        CryptoService,
      ],
    },
  ],
})
export class ImportComponent implements OnInit, OnDestroy, AfterViewInit {
  featuredImportOptions: ImportOption[];
  importOptions: ImportOption[];
  format: ImportType = null;
  fileSelected: File;

  folders$: Observable<FolderView[]>;
  collections$: Observable<CollectionView[]>;
  organizations$: Observable<Organization[]>;

  private _organizationId: string;

  get organizationId(): string {
    return this._organizationId;
  }

  @Input() set organizationId(value: string) {
    this._organizationId = value;
    this.organizationService
      .get$(this._organizationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((organization) => {
        this._organizationId = organization?.id;
        this.organization = organization;
      });
  }

  protected organization: Organization;
  protected destroy$ = new Subject<void>();

  private _importBlockedByPolicy = false;

  formGroup = this.formBuilder.group({
    vaultSelector: [
      "myVault",
      {
        nonNullable: true,
        validators: [Validators.required],
      },
    ],
    targetSelector: [null],
    format: [null as ImportType | null, [Validators.required]],
    fileContents: [],
    file: [],
    lastPassType: ["direct" as "csv" | "direct"],
  });

  @ViewChild(BitSubmitDirective)
  private bitSubmit: BitSubmitDirective;

  @Output()
  formLoading = new EventEmitter<boolean>();

  @Output()
  formDisabled = new EventEmitter<boolean>();

  @Output()
  onSuccessfulImport = new EventEmitter<string>();

  ngAfterViewInit(): void {
    this.bitSubmit.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
      this.formLoading.emit(loading);
    });

    this.bitSubmit.disabled$.pipe(takeUntil(this.destroy$)).subscribe((disabled) => {
      this.formDisabled.emit(disabled);
    });
  }

  constructor(
    protected i18nService: I18nService,
    protected importService: ImportServiceAbstraction,
    protected platformUtilsService: PlatformUtilsService,
    protected policyService: PolicyService,
    private logService: LogService,
    protected syncService: SyncService,
    protected dialogService: DialogService,
    protected folderService: FolderService,
    protected collectionService: CollectionService,
    protected organizationService: OrganizationService,
    protected formBuilder: FormBuilder,
  ) {}

  protected get importBlockedByPolicy(): boolean {
    return this._importBlockedByPolicy;
  }

  protected get showLastPassToggle(): boolean {
    return (
      this.format === "lastpasscsv" &&
      (this.platformUtilsService.getClientType() === ClientType.Desktop ||
        this.platformUtilsService.getClientType() === ClientType.Browser)
    );
  }
  protected get showLastPassOptions(): boolean {
    return this.showLastPassToggle && this.formGroup.controls.lastPassType.value === "direct";
  }

  ngOnInit() {
    this.setImportOptions();

    this.organizations$ = concat(
      this.organizationService.memberOrganizations$.pipe(
        canAccessImportExport(this.i18nService),
        map((orgs) => orgs.sort(Utils.getSortFunction(this.i18nService, "name"))),
      ),
    );

    combineLatest([
      this.policyService.policyAppliesToActiveUser$(PolicyType.PersonalOwnership),
      this.organizations$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([policyApplies, orgs]) => {
        this._importBlockedByPolicy = policyApplies;
        if (policyApplies && orgs.length == 0) {
          this.formGroup.disable();
        }
      });

    if (this.organizationId) {
      this.formGroup.controls.vaultSelector.patchValue(this.organizationId);
      this.formGroup.controls.vaultSelector.disable();

      this.collections$ = Utils.asyncToObservable(() =>
        this.collectionService
          .getAllDecrypted()
          .then((c) => c.filter((c2) => c2.organizationId === this.organizationId)),
      );
    } else {
      // Filter out the `no folder`-item from folderViews$
      this.folders$ = this.folderService.folderViews$.pipe(
        map((folders) => folders.filter((f) => f.id != null)),
      );
      this.formGroup.controls.targetSelector.disable();

      this.formGroup.controls.vaultSelector.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((value) => {
          this.organizationId = value != "myVault" ? value : undefined;
          if (!this._importBlockedByPolicy) {
            this.formGroup.controls.targetSelector.enable();
          }
          if (value) {
            this.collections$ = Utils.asyncToObservable(() =>
              this.collectionService
                .getAllDecrypted()
                .then((c) => c.filter((c2) => c2.organizationId === value)),
            );
          }
        });

      this.formGroup.controls.vaultSelector.setValue("myVault");
    }
    this.formGroup.controls.format.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        this.format = value;
      });
  }

  submit = async () => {
    await this.asyncValidatorsFinished();

    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }

    await this.performImport();
  };

  private async asyncValidatorsFinished() {
    if (this.formGroup.pending) {
      await firstValueFrom(
        this.formGroup.statusChanges.pipe(filter((status) => status !== "PENDING")),
      );
    }
  }

  protected async performImport() {
    if (this.organization) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "warning" },
        content: { key: "importWarning", placeholders: [this.organization.name] },
        type: "warning",
      });

      if (!confirmed) {
        return;
      }
    }

    if (this.importBlockedByPolicy) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("personalOwnershipPolicyInEffectImports"),
      );
      return;
    }

    const promptForPassword_callback = async () => {
      return await this.getFilePassword();
    };

    const importer = this.importService.getImporter(
      this.format,
      promptForPassword_callback,
      this.organizationId,
    );

    if (importer === null) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("selectFormat"),
      );
      return;
    }

    const fileEl = document.getElementById("import_input_file") as HTMLInputElement;
    const files = fileEl.files;
    let fileContents = this.formGroup.controls.fileContents.value;
    if ((files == null || files.length === 0) && (fileContents == null || fileContents === "")) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("selectFile"),
      );
      return;
    }

    if (files != null && files.length > 0) {
      try {
        const content = await this.getFileContents(files[0]);
        if (content != null) {
          fileContents = content;
        }
      } catch (e) {
        this.logService.error(e);
      }
    }

    if (fileContents == null || fileContents === "") {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("selectFile"),
      );
      return;
    }

    if (this.organizationId) {
      await this.organizationService.get(this.organizationId)?.isAdmin;
    }

    try {
      const result = await this.importService.import(
        importer,
        fileContents,
        this.organizationId,
        this.formGroup.controls.targetSelector.value,
        this.canAccessImportExport(this.organizationId),
      );

      //No errors, display success message
      this.dialogService.open<unknown, ImportResult>(ImportSuccessDialogComponent, {
        data: result,
      });

      this.syncService.fullSync(true);
      this.onSuccessfulImport.emit(this._organizationId);
    } catch (e) {
      this.dialogService.open<unknown, Error>(ImportErrorDialogComponent, {
        data: e,
      });
      this.logService.error(e);
    }
  }

  private isUserAdmin(organizationId?: string): boolean {
    if (!organizationId) {
      return false;
    }
    return this.organizationService.get(this.organizationId)?.isAdmin;
  }

  private canAccessImportExport(organizationId?: string): boolean {
    if (!organizationId) {
      return false;
    }
    return this.organizationService.get(this.organizationId)?.canAccessImportExport;
  }

  getFormatInstructionTitle() {
    if (this.format == null) {
      return null;
    }

    const results = this.featuredImportOptions
      .concat(this.importOptions)
      .filter((o) => o.id === this.format);
    if (results.length > 0) {
      return this.i18nService.t("instructionsFor", results[0].name);
    }
    return null;
  }

  protected setImportOptions() {
    this.featuredImportOptions = [
      {
        id: null,
        name: "-- " + this.i18nService.t("select") + " --",
      },
      ...this.importService.featuredImportOptions,
    ];
    this.importOptions = [...this.importService.regularImportOptions].sort((a, b) => {
      if (a.name == null && b.name != null) {
        return -1;
      }
      if (a.name != null && b.name == null) {
        return 1;
      }
      if (a.name == null && b.name == null) {
        return 0;
      }

      return this.i18nService.collator
        ? this.i18nService.collator.compare(a.name, b.name)
        : a.name.localeCompare(b.name);
    });
  }

  setSelectedFile(event: Event) {
    const fileInputEl = <HTMLInputElement>event.target;
    this.fileSelected = fileInputEl.files.length > 0 ? fileInputEl.files[0] : null;
  }

  private getFileContents(file: File): Promise<string> {
    if (this.format === "1password1pux" && file.name.endsWith(".1pux")) {
      return this.extractZipContent(file, "export.data");
    }
    if (
      this.format === "protonpass" &&
      (file.type === "application/zip" ||
        file.type == "application/x-zip-compressed" ||
        file.name.endsWith(".zip"))
    ) {
      return this.extractZipContent(file, "Proton Pass/data.json");
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file, "utf-8");
      reader.onload = (evt) => {
        if (this.format === "lastpasscsv" && file.type === "text/html") {
          const parser = new DOMParser();
          const doc = parser.parseFromString((evt.target as any).result, "text/html");
          const pre = doc.querySelector("pre");
          if (pre != null) {
            resolve(pre.textContent);
            return;
          }
          reject();
          return;
        }

        resolve((evt.target as any).result);
      };
      reader.onerror = () => {
        reject();
      };
    });
  }

  private extractZipContent(zipFile: File, contentFilePath: string): Promise<string> {
    return new JSZip()
      .loadAsync(zipFile)
      .then((zip) => {
        return zip.file(contentFilePath).async("string");
      })
      .then(
        function success(content) {
          return content;
        },
        function error(e) {
          return "";
        },
      );
  }

  async getFilePassword(): Promise<string> {
    const dialog = this.dialogService.open<string>(FilePasswordPromptComponent, {
      ariaModal: true,
    });

    return await lastValueFrom(dialog.closed);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
