import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import * as JSZip from "jszip";
import { concat, Observable, Subject, lastValueFrom, combineLatest } from "rxjs";
import { map, takeUntil } from "rxjs/operators";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import {
  canAccessImportExport,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DialogService } from "@bitwarden/components";
import {
  ImportOption,
  ImportResult,
  ImportServiceAbstraction,
  ImportType,
} from "@bitwarden/importer";

import {
  FilePasswordPromptComponent,
  ImportErrorDialogComponent,
  ImportSuccessDialogComponent,
} from "./dialog";

@Component({
  selector: "app-import",
  templateUrl: "import.component.html",
})
export class ImportComponent implements OnInit, OnDestroy {
  featuredImportOptions: ImportOption[];
  importOptions: ImportOption[];
  format: ImportType = null;
  fileSelected: File;

  folders$: Observable<FolderView[]>;
  collections$: Observable<CollectionView[]>;
  organizations$: Observable<Organization[]>;

  protected organizationId: string = null;
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
  });

  constructor(
    protected i18nService: I18nService,
    protected importService: ImportServiceAbstraction,
    protected router: Router,
    protected platformUtilsService: PlatformUtilsService,
    protected policyService: PolicyService,
    private logService: LogService,
    protected modalService: ModalService,
    protected syncService: SyncService,
    protected dialogService: DialogService,
    protected folderService: FolderService,
    protected collectionService: CollectionService,
    protected organizationService: OrganizationService,
    protected formBuilder: FormBuilder
  ) {}

  protected get importBlockedByPolicy(): boolean {
    return this._importBlockedByPolicy;
  }

  /**
   * Callback that is called after a successful import.
   */
  protected async onSuccessfulImport(): Promise<void> {
    await this.router.navigate(["vault"]);
  }

  ngOnInit() {
    this.setImportOptions();

    this.organizations$ = concat(
      this.organizationService.memberOrganizations$.pipe(
        canAccessImportExport(this.i18nService),
        map((orgs) => orgs.sort(Utils.getSortFunction(this.i18nService, "name")))
      )
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
          .then((c) => c.filter((c2) => c2.organizationId === this.organizationId))
      );
    } else {
      // Filter out the `no folder`-item from folderViews$
      this.folders$ = this.folderService.folderViews$.pipe(
        map((folders) => folders.filter((f) => f.id != null))
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
                .then((c) => c.filter((c2) => c2.organizationId === value))
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
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }

    await this.performImport();
  };

  protected async performImport() {
    if (this.importBlockedByPolicy) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("personalOwnershipPolicyInEffectImports")
      );
      return;
    }

    const promptForPassword_callback = async () => {
      return await this.getFilePassword();
    };

    const importer = this.importService.getImporter(
      this.format,
      promptForPassword_callback,
      this.organizationId
    );

    if (importer === null) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("selectFormat")
      );
      return;
    }

    const fileEl = document.getElementById("file") as HTMLInputElement;
    const files = fileEl.files;
    let fileContents = this.formGroup.controls.fileContents.value;
    if ((files == null || files.length === 0) && (fileContents == null || fileContents === "")) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("selectFile")
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
        this.i18nService.t("selectFile")
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
        this.isUserAdmin(this.organizationId)
      );

      //No errors, display success message
      this.dialogService.open<unknown, ImportResult>(ImportSuccessDialogComponent, {
        data: result,
      });

      this.syncService.fullSync(true);
      await this.onSuccessfulImport();
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
        }
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
