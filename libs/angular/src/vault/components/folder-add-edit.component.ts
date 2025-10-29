// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { Validators, FormBuilder } from "@angular/forms";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

@Directive()
export class FolderAddEditComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() folderId: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onSavedFolder = new EventEmitter<FolderView>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onDeletedFolder = new EventEmitter<FolderView>();

  editMode = false;
  folder: FolderView = new FolderView();
  title: string;
  formPromise: Promise<any>;
  deletePromise: Promise<any>;
  protected componentName = "";

  protected activeUserId$ = this.accountService.activeAccount$.pipe(map((a) => a?.id));

  formGroup = this.formBuilder.group({
    name: ["", [Validators.required]],
  });

  constructor(
    protected folderService: FolderService,
    protected folderApiService: FolderApiServiceAbstraction,
    protected accountService: AccountService,
    protected keyService: KeyService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected logService: LogService,
    protected dialogService: DialogService,
    protected formBuilder: FormBuilder,
    protected toastService: ToastService,
  ) {}

  async ngOnInit() {
    await this.init();
  }

  async submit(): Promise<boolean> {
    this.folder.name = this.formGroup.controls.name.value;
    if (this.folder.name == null || this.folder.name === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nameRequired"),
      });
      return false;
    }

    try {
      const activeUserId = await firstValueFrom(this.activeUserId$);
      const userKey = await this.keyService.getUserKey(activeUserId);
      const folder = await this.folderService.encrypt(this.folder, userKey);
      this.formPromise = this.folderApiService.save(folder, activeUserId);
      await this.formPromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t(this.editMode ? "editedFolder" : "addedFolder"),
      });
      this.onSavedFolder.emit(this.folder);
      return true;
    } catch (e) {
      this.logService.error(e);
    }

    return false;
  }

  async delete(): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteFolder" },
      content: { key: "deleteFolderConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      const activeUserId = await firstValueFrom(this.activeUserId$);
      this.deletePromise = this.folderApiService.delete(this.folder.id, activeUserId);
      await this.deletePromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("deletedFolder"),
      });
      this.onDeletedFolder.emit(this.folder);
    } catch (e) {
      this.logService.error(e);
    }

    return true;
  }

  protected async init() {
    this.editMode = this.folderId != null;

    if (this.editMode) {
      this.editMode = true;
      this.title = this.i18nService.t("editFolder");
      const activeUserId = await firstValueFrom(this.activeUserId$);
      this.folder = await firstValueFrom(
        this.folderService.getDecrypted$(this.folderId, activeUserId),
      );
    } else {
      this.title = this.i18nService.t("addFolder");
    }
    this.formGroup.controls.name.setValue(this.folder.name);
  }
}
