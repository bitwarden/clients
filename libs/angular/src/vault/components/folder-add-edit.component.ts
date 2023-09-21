import { Directive, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { Validators, FormBuilder } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DialogService } from "@bitwarden/components";

@Directive()
export class FolderAddEditComponent implements OnInit {
  @Input() folderId: string;
  @Output() onSavedFolder = new EventEmitter<FolderView>();
  @Output() onDeletedFolder = new EventEmitter<FolderView>();

  editMode = false;
  folder: FolderView = new FolderView();
  title: string;
  formPromise: Promise<any>;
  deletePromise: Promise<any>;
  protected componentName = "";

  formGroup = this.formBuilder.group({
    name: ["", [Validators.required]],
  });

  constructor(
    protected folderService: FolderService,
    protected folderApiService: FolderApiServiceAbstraction,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected logService: LogService,
    protected dialogService: DialogService,
    protected formBuilder: FormBuilder
  ) {}

  async ngOnInit() {
    await this.init();
  }

  async submit(): Promise<boolean> {
    this.folder.name = this.formGroup.controls.name.value;
    if (this.folder.name == null || this.folder.name === "") {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nameRequired")
      );
      return false;
    }

    try {
      const folder = await this.folderService.encrypt(this.folder);
      this.formPromise = this.folderApiService.save(folder);
      await this.formPromise;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t(this.editMode ? "editedFolder" : "addedFolder")
      );
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
      this.deletePromise = this.folderApiService.delete(this.folder.id);
      await this.deletePromise;
      this.platformUtilsService.showToast("success", null, this.i18nService.t("deletedFolder"));
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
      const folder = await this.folderService.get(this.folderId);
      this.folder = await folder.decrypt();
    } else {
      this.title = this.i18nService.t("addFolder");
    }
    this.formGroup.controls.name.setValue(this.folder.name);
  }
}
