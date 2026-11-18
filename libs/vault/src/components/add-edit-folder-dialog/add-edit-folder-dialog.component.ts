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
import { combineLatest, firstValueFrom, map, of, shareReplay, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { NestingDelimiter } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { composeFolderName, parseFolderName } from "@bitwarden/common/vault/utils/folder-utils";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  BitSubmitDirective,
  ButtonComponent,
  ButtonModule,
  CalloutModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  SelectModule,
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
  /** Preselects this folder in the "Nest folder under" select when adding a folder. */
  parentFolderId?: string;
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
    CalloutModule,
    FormFieldModule,
    ReactiveFormsModule,
    IconButtonModule,
    AsyncActionsModule,
    SelectModule,
  ],
})
export class AddEditFolderDialogComponent implements AfterViewInit, OnInit {
  private readonly configService = inject(ConfigService);
  private readonly nudgesService = inject(NudgesService);
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(BitSubmitDirective) private bitSubmit?: BitSubmitDirective;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("submitBtn") private submitBtn?: ButtonComponent;

  private readonly vfo1Enabled$ = this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation);

  protected readonly vfo1Enabled = toSignal(this.vfo1Enabled$, { initialValue: false });

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

    if (value.includes(NestingDelimiter)) {
      return {
        folderNameSlashNotAllowed: { message: this.i18nService.t("folderNameSlashNotAllowed") },
      };
    }

    return null;
  };

  folderForm = this.formBuilder.group({
    name: ["", this.nameValidator],
    /** Full path of the folder to nest under, `null` for none; only offered when VFO1 is on. */
    parent: [null as string | null],
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

  private readonly folders$ = this.activeUserId$.pipe(
    switchMap((userId) => (userId == null ? of([]) : this.folderService.folderViews$(userId))),
    map((folders) => folders.filter((f) => !!f.id && !!f.name)),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /** Full paths the folder can be nested under, sorted for display. */
  protected readonly parentOptions = toSignal(
    this.folders$.pipe(map((folders) => this.buildParentOptions(folders))),
    { initialValue: [] as string[] },
  );

  /** Shown to accounts that predate VFO1 until dismissed from either dialog variant. */
  protected readonly showNestingCallout = toSignal(
    combineLatest([this.vfo1Enabled$, this.activeUserId$]).pipe(
      switchMap(([vfo1Enabled, userId]) =>
        vfo1Enabled && userId != null
          ? this.nudgesService.showNudgeSpotlight$(NudgeType.Vfo1FolderNestingCallout, userId)
          : of(false),
      ),
    ),
    { initialValue: false },
  );

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

  async ngOnInit(): Promise<void> {
    if (this.data?.editFolderConfig) {
      this.variant = "edit";
      this.folderForm.controls.name.setValue(this.data.editFolderConfig.folder.name);
      this.folder = this.data.editFolderConfig.folder;
    } else {
      // Create a new folder view
      this.folder = new FolderView();
    }

    if (await firstValueFrom(this.vfo1Enabled$)) {
      if (this.variant === "edit") {
        // Nesting is encoded in the stored name, so split it across the name field and the select.
        const { name, parent } = parseFolderName(this.folder.name);
        this.folderForm.patchValue({ name, parent: parent ?? null });
        return;
      }

      const parentFolderId = this.data?.parentFolderId;
      if (parentFolderId) {
        const folders = await firstValueFrom(this.folders$);
        const parent = folders.find((f) => f.id === parentFolderId);
        if (parent) {
          this.folderForm.controls.parent.setValue(normalizedPath(parent.name));
        }
      }
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
    this.folder.name = this.vfo1Enabled()
      ? composeFolderName(this.folderForm.controls.parent.value, name.trim())
      : name;

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

  /** Hides the nesting callout on both dialog variants for good, on this client only. */
  protected async dismissNestingCallout(): Promise<void> {
    const userId = await firstValueFrom(this.activeUserId$);
    if (userId == null) {
      return;
    }

    await this.nudgesService.dismissNudge(NudgeType.Vfo1FolderNestingCallout, userId);
  }

  /**
   * Every folder path, minus the folder being edited and its descendants so a folder cannot be
   * nested under itself. A parent that only exists as part of the edited folder's name (no folder
   * holds that path) stays selectable so saving does not silently un-nest it.
   */
  private buildParentOptions(folders: FolderView[]): string[] {
    const editedFolder = this.data?.editFolderConfig?.folder;
    const editedPath = editedFolder ? normalizedPath(editedFolder.name) : undefined;

    const paths = new Set(
      folders
        .filter((f) => f.id !== editedFolder?.id)
        .map((f) => normalizedPath(f.name))
        .filter(
          (path) =>
            editedPath === undefined ||
            (path !== editedPath && !path.startsWith(`${editedPath}${NestingDelimiter}`)),
        ),
    );

    const compare = (a: string, b: string) =>
      this.i18nService.collator?.compare(a, b) ?? a.localeCompare(b);
    const options = [...paths].sort(compare);

    const impliedParent = editedPath ? parseFolderName(editedPath).parent : undefined;
    if (impliedParent && !paths.has(impliedParent)) {
      options.unshift(impliedParent);
    }

    return options;
  }

  /** Success toast key for the current variant. */
  private savedMessageKey(): string {
    if (!this.vfo1Enabled()) {
      return "editedFolder";
    }

    return this.variant === "edit" ? "folderEdited" : "addedFolder";
  }

  get title() {
    return this.variant === "add" ? "addFolder" : "editFolder";
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

/** A stored folder name with its outer delimiters trimmed, matching how the folder tree reads it. */
function normalizedPath(name: string): string {
  const { name: ownName, parent } = parseFolderName(name);
  return composeFolderName(parent, ownName);
}
