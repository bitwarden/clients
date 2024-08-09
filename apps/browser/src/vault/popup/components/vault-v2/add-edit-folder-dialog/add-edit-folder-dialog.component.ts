import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  DestroyRef,
  inject,
  Inject,
  OnInit,
  ViewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  AsyncActionsModule,
  BitSubmitDirective,
  ButtonComponent,
  ButtonModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";

export type AddEditFolderDialogData = {
  /** When provided, dialog will display edit folder variant */
  editFolderConfig?: { folder: FolderView };
};

@Component({
  standalone: true,
  selector: "vault-add-edit-folder-dialog",
  templateUrl: "./add-edit-folder-dialog.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    FormFieldModule,
    ReactiveFormsModule,
    IconButtonModule,
    AsyncActionsModule,
  ],
})
export class AddEditFolderDialogComponent implements AfterViewInit, OnInit {
  @ViewChild(BitSubmitDirective) private bitSubmit: BitSubmitDirective;
  @ViewChild("submitBtn") private submitBtn: ButtonComponent;

  folder: FolderView;

  variant: "add" | "edit";

  folderForm = this.formBuilder.group({
    name: ["", Validators.required],
  });

  private destroyRef = inject(DestroyRef);

  constructor(
    private formBuilder: FormBuilder,
    private folderService: FolderService,
    private folderApiService: FolderApiServiceAbstraction,
    private toastService: ToastService,
    private i18nService: I18nService,
    private logService: LogService,
    private dialogService: DialogService,
    private dialogRef: DialogRef,
    @Inject(DIALOG_DATA) private data?: AddEditFolderDialogData,
  ) {}

  ngOnInit(): void {
    this.variant = this.data?.editFolderConfig ? "edit" : "add";

    if (this.variant === "edit") {
      this.folderForm.controls.name.setValue(this.data.editFolderConfig.folder.name);
      this.folder = this.data.editFolderConfig.folder;
    } else {
      // Create a new folder view
      this.folder = new FolderView();
    }
  }

  ngAfterViewInit(): void {
    this.bitSubmit.loading$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((loading) => {
      if (!this.submitBtn) {
        return;
      }

      this.submitBtn.loading = loading;
    });
  }

  /** Submit the new folder */
  submit = async () => {
    if (this.folderForm.invalid) {
      return;
    }

    this.folder.name = this.folderForm.controls.name.value;

    try {
      const folder = await this.folderService.encrypt(this.folder);
      await this.folderApiService.save(folder);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("editedFolder"),
      });

      this.close();
    } catch (e) {
      this.logService.error(e);
    }
  };

  /** Delete the folder with when the user provides a confirmation */
  deleteFolder = async () => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteFolder" },
      content: { key: "deleteFolderPermanently" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.folderApiService.delete(this.folder.id);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("deletedFolder"),
      });
    } catch (e) {
      this.logService.error(e);
    }

    this.close();
  };

  /** Close the dialog */
  private close() {
    this.dialogRef.close();
  }
}
