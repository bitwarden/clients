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
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from "@angular/forms";
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  DIALOG_DATA,
  DialogRef,
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
import { KeyService } from "@bitwarden/key-management";

export const AddEditFolderDialogResult = {
  Created: "created",
  Deleted: "deleted",
} as const;

export type AddEditFolderDialogResult = UnionOfValues<typeof AddEditFolderDialogResult>;

export type AddEditFolderDialogData = {
  /** When provided, dialog will display edit folder variant */
  editFolderConfig?: { folder: FolderView };
  /** Hides the in-dialog delete affordance for callers that surface deletion themselves. */
  hideDelete?: boolean;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
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
  private readonly configService = inject(ConfigService);
  protected readonly btnTextAddCreateFeatureFlag = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM32380_BtnTextAddCreate),
    { initialValue: false },
  );
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(BitSubmitDirective) private bitSubmit?: BitSubmitDirective;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("submitBtn") private submitBtn?: ButtonComponent;

  protected readonly vfo1Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  folder: FolderView = new FolderView();

  variant: "add" | "edit" = "add";

  /** Applies the VFO1 name rules when the flag is on, a bare required check otherwise. */
  private readonly nameValidator: ValidatorFn = (control) => {
    if (!this.vfo1Enabled()) {
      return Validators.required(control);
    }

    const value: string = (control.value ?? "").trim();

    if (value.length === 0) {
      return { folderNameRequired: { message: this.i18nService.t("enterAName") } };
    }

    return null;
  };

  folderForm = this.formBuilder.group({
    name: ["", this.nameValidator],
  });

  /** Callers can suppress the delete affordance even in the edit variant. */
  protected get showDelete(): boolean {
    return this.variant === "edit" && !this.data?.hideDelete;
  }

  /** Disabled while the form is invalid, unless VFO1 is on. */
  protected get disableSubmit(): boolean {
    return !this.vfo1Enabled() && this.folderForm.invalid;
  }

  private activeUserId$ = this.accountService.activeAccount$.pipe(map((a) => a?.id));
  private destroyRef = inject(DestroyRef);

  constructor(
    private formBuilder: FormBuilder,
    private folderService: FolderService,
    private folderApiService: FolderApiServiceAbstraction,
    private accountService: AccountService,
    private keyService: KeyService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private logService: LogService,
    private dialogService: DialogService,
    private dialogRef: DialogRef<AddEditFolderDialogResult>,
    @Inject(DIALOG_DATA) private data?: AddEditFolderDialogData,
  ) {
    // Reactive forms do not track signals, and the flag can resolve after the control is built.
    toObservable(this.vfo1Enabled)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.folderForm.controls.name.updateValueAndValidity());
  }

  ngOnInit(): void {
    if (this.data?.editFolderConfig) {
      this.variant = "edit";
      this.folderForm.controls.name.setValue(this.data.editFolderConfig.folder.name);
      this.folder = this.data.editFolderConfig.folder;
    } else {
      // Create a new folder view
      this.folder = new FolderView();
    }
  }

  ngAfterViewInit(): void {
    this.bitSubmit?.loading$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((loading) => {
      if (!this.submitBtn) {
        return;
      }

      this.submitBtn.loading.set(loading);
    });
  }

  /** Submit the new folder */
  submit = async () => {
    if (this.folderForm.invalid) {
      this.folderForm.markAllAsTouched();
      return;
    }

    const name = this.folderForm.controls.name.value ?? "";
    this.folder.name = this.vfo1Enabled() ? name.trim() : name;

    try {
      const activeUserId = await firstValueFrom(this.activeUserId$);
      const userKey = (await firstValueFrom(this.keyService.userKey$(activeUserId!)))!;
      const folder = await this.folderService.encrypt(this.folder, userKey);
      await this.folderApiService.save(folder, activeUserId!);

      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t(this.savedMessageKey()),
      });

      this.close(AddEditFolderDialogResult.Created);
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
      const activeUserId = await firstValueFrom(this.activeUserId$);
      await this.folderApiService.delete(this.folder.id, activeUserId!);
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("deletedFolder"),
      });
    } catch (e) {
      this.logService.error(e);
    }

    this.close(AddEditFolderDialogResult.Deleted);
  };

  /** Success toast key for the current variant. */
  private savedMessageKey(): string {
    if (!this.vfo1Enabled()) {
      return "editedFolder";
    }

    return this.variant === "edit" ? "folderEdited" : "addedFolder";
  }

  //when unwinding this feature flag, move to a ternary in the .html file
  get title() {
    if (this.variant === "add") {
      if (this.btnTextAddCreateFeatureFlag()) {
        return "addFolder";
      } else {
        return "newFolder";
      }
    } else {
      return "editFolder";
    }
  }

  /** Close the dialog */
  private close(result: AddEditFolderDialogResult) {
    void this.dialogRef.close(result);
  }

  static open(dialogService: DialogService, data?: AddEditFolderDialogData) {
    return dialogService.open<AddEditFolderDialogResult, AddEditFolderDialogData>(
      AddEditFolderDialogComponent,
      { data },
    );
  }
}
