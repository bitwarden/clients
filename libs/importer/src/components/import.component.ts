// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Optional,
  Output,
  ViewChild,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import * as JSZip from "jszip";
import { Observable, Subject, lastValueFrom, combineLatest, firstValueFrom } from "rxjs";
import { combineLatestWith, filter, map, switchMap, takeUntil } from "rxjs/operators";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { safeProvider, SafeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ClientType } from "@bitwarden/common/enums";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  AsyncActionsModule,
  BitSubmitDirective,
  ButtonModule,
  CalloutModule,
  CardComponent,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  RadioButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  ToastService,
  LinkModule,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { ImportOption, ImportResult, ImportType } from "../models";
import {
  ImportApiService,
  ImportApiServiceAbstraction,
  ImportCollectionServiceAbstraction,
  ImportService,
  ImportServiceAbstraction,
} from "../services";

import {
  FilePasswordPromptComponent,
  ImportErrorDialogComponent,
  ImportSuccessDialogComponent,
} from "./dialog";
import { ImportLastPassComponent } from "./lastpass";

const safeProviders: SafeProvider[] = [
  safeProvider({
    provide: ImportApiServiceAbstraction,
    useClass: ImportApiService,
    deps: [ApiService],
  }),
  safeProvider({
    provide: ImportServiceAbstraction,
    useClass: ImportService,
    deps: [
      CipherService,
      FolderService,
      ImportApiServiceAbstraction,
      I18nService,
      CollectionService,
      KeyService,
      EncryptService,
      PinServiceAbstraction,
      AccountService,
      SdkService,
    ],
  }),
];

@Component({
  selector: "tools-import",
  templateUrl: "import.component.html",
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
    CardComponent,
    SectionHeaderComponent,
    SectionComponent,
    LinkModule,
  ],
  providers: safeProviders,
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
    getUserId(this.accountService.activeAccount$)
      .pipe(
        switchMap((userId) =>
          this.organizationService
            .organizations$(userId)
            .pipe(getOrganizationById(this._organizationId)),
        ),
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe((organization) => {
        this._organizationId = organization?.id;
        this.organization = organization;
      });
  }

  protected organization: Organization;
  protected destroy$ = new Subject<void>();

  protected readonly isCardTypeRestricted$: Observable<boolean> =
    this.restrictedItemTypesService.restricted$.pipe(map((items) => items.length > 0));

  private _importBlockedByPolicy = false;
  protected isFromAC = false;

  private activeUserId$ = this.accountService.activeAccount$.pipe(map((a) => a?.id));

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
    protected organizationService: OrganizationService,
    protected collectionService: CollectionService,
    protected formBuilder: FormBuilder,
    @Inject(ImportCollectionServiceAbstraction)
    @Optional()
    protected importCollectionService: ImportCollectionServiceAbstraction,
    protected toastService: ToastService,
    protected accountService: AccountService,
    private restrictedItemTypesService: RestrictedItemTypesService,
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

  async ngOnInit() {
    this.setImportOptions();

    if (this.organizationId) {
      await this.handleOrganizationImportInit();
    } else {
      await this.handleImportInit();
    }

    this.formGroup.controls.format.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        this.format = value;
      });

    await this.handlePolicies();
  }

  private async handleOrganizationImportInit() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.organizations$ = this.organizationService
      .memberOrganizations$(userId)
      .pipe(
        map((orgs) =>
          orgs.filter(
            (org) =>
              org.id == this.organizationId && (org.canAccessImport || org.canCreateNewCollections),
          ),
        ),
      );

    this.formGroup.controls.vaultSelector.patchValue(this.organizationId);
    this.formGroup.controls.vaultSelector.disable();

    this.collections$ = Utils.asyncToObservable(() =>
      this.importCollectionService
        .getAllAdminCollections(this.organizationId)
        .then((collections) => collections.sort(Utils.getSortFunction(this.i18nService, "name"))),
    );

    this.isFromAC = true;
  }

  private async handleImportInit() {
    // Filter out the no folder-item from folderViews$
    this.folders$ = this.activeUserId$.pipe(
      switchMap((userId) => {
        return this.folderService.folderViews$(userId);
      }),
      map((folders) => folders.filter((f) => f.id != null)),
    );

    this.formGroup.controls.targetSelector.disable();

    // Retrieve all organizations a user is a member of and has collections they can manage
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.organizations$ = this.organizationService.memberOrganizations$(userId).pipe(
      combineLatestWith(this.collectionService.decryptedCollections$),
      map(([organizations, collections]) =>
        organizations
          .filter((org) => collections.some((c) => c.organizationId === org.id && c.manage))
          .sort(Utils.getSortFunction(this.i18nService, "name")),
      ),
    );

    combineLatest([this.formGroup.controls.vaultSelector.valueChanges, this.organizations$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([value, organizations]) => {
        this.organizationId = value !== "myVault" ? value : undefined;

        if (!this._importBlockedByPolicy) {
          this.formGroup.controls.targetSelector.enable();
        }

        if (value) {
          this.collections$ = Utils.asyncToObservable(() =>
            this.collectionService
              .getAllDecrypted()
              .then((decryptedCollections) =>
                decryptedCollections
                  .filter((c2) => c2.organizationId === value && c2.manage)
                  .sort(Utils.getSortFunction(this.i18nService, "name")),
              ),
          );
        }
      });
    this.formGroup.controls.vaultSelector.setValue("myVault");
  }

  private async handlePolicies() {
    combineLatest([
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) =>
          this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
        ),
      ),
      this.organizations$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([policyApplies, orgs]) => {
        this._importBlockedByPolicy = policyApplies;
        if (policyApplies && orgs.length == 0) {
          this.formGroup.disable();
        }

        // If there are orgs the user has access to import into set
        // the default value to the first org in the collection.
        if (policyApplies && orgs.length > 0) {
          this.formGroup.controls.vaultSelector.setValue(orgs[0].id);
        }
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
    if (!(await this.validateImport())) {
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
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("selectFormat"),
      });
      return;
    }

    const importContents = await this.setImportContents();

    if (importContents == null || importContents === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("selectFile"),
      });
      return;
    }

    try {
      const result = await this.importService.import(
        importer,
        importContents,
        this.organizationId,
        this.formGroup.controls.targetSelector.value,
        (await this.canAccessImport(this.organizationId)) && this.isFromAC,
      );

      //No errors, display success message
      this.dialogService.open<unknown, ImportResult>(ImportSuccessDialogComponent, {
        data: result,
      });

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.syncService.fullSync(true);
      this.onSuccessfulImport.emit(this._organizationId);
    } catch (e) {
      this.dialogService.open<unknown, Error>(ImportErrorDialogComponent, {
        data: e,
      });
      this.logService.error(e);
    }
  }

  private async canAccessImport(organizationId?: string): Promise<boolean> {
    if (!organizationId) {
      return false;
    }
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    return (
      await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(this.organizationId)),
      )
    )?.canAccessImport;
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
    this.featuredImportOptions = [...this.importService.featuredImportOptions];

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

  private async validateImport(): Promise<boolean> {
    if (this.organization) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "warning" },
        content: { key: "importWarning", placeholders: [this.organization.name] },
        type: "warning",
      });

      if (!confirmed) {
        return false;
      }
    }

    if (this.importBlockedByPolicy && this.organizationId == null) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("personalOwnershipPolicyInEffectImports"),
      });
      return false;
    }

    return true;
  }

  private async setImportContents(): Promise<string> {
    const fileEl = document.getElementById("import_input_file") as HTMLInputElement;
    const files = fileEl.files;
    let fileContents = this.formGroup.controls.fileContents.value;

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

    return fileContents;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
