import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  DialogConfig,
  DialogRef,
  DIALOG_DATA,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { Vfo1TerminologyService } from "../../../services/vfo1-terminology.service";

/** A selected item and the folder it currently sits in. */
export interface BulkMoveDialogCipher {
  id: string;
  folderId?: string | null;
}

export interface BulkMoveDialogParams {
  ciphers?: BulkMoveDialogCipher[];
}

export const BulkMoveDialogResult = {
  Moved: "moved",
  Canceled: "canceled",
} as const;

type BulkMoveDialogResult = UnionOfValues<typeof BulkMoveDialogResult>;

/** The id of the "No folder" option `FolderService.folderViews$` appends. */
const NO_FOLDER_ID = "";

const folderIdOf = (cipher: BulkMoveDialogCipher): string => cipher.folderId ?? NO_FOLDER_ID;

/**
 * Strongly typed helper to open a BulkMoveDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export const openBulkMoveDialog = (
  dialogService: DialogService,
  config: DialogConfig<BulkMoveDialogParams>,
) => {
  return dialogService.open<BulkMoveDialogResult, BulkMoveDialogParams>(
    BulkMoveDialogComponent,
    config,
  );
};

@Component({
  templateUrl: "bulk-move-dialog.component.html",
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkMoveDialogComponent {
  private readonly params = inject<BulkMoveDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<BulkMoveDialogResult>>(DialogRef);
  private readonly cipherService = inject(CipherService);
  private readonly i18nService = inject(I18nService);
  private readonly folderService = inject(FolderService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly toastService = inject(ToastService);
  private readonly accountService = inject(AccountService);
  protected readonly vfo1TerminologyService = inject(Vfo1TerminologyService);

  protected readonly ciphers = this.params.ciphers ?? [];

  /** The folder every selected item already sits in, or `undefined` when they differ. */
  protected readonly sharedFolderId = this.findSharedFolderId();

  protected readonly formGroup = this.formBuilder.group({
    folderId: this.formBuilder.control<string | null>(this.sharedFolderId ?? null),
  });

  protected readonly folders = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.folderService.folderViews$(userId)),
    ),
    { initialValue: [] },
  );

  private readonly folderId = toSignal(this.formGroup.controls.folderId.valueChanges, {
    initialValue: this.sharedFolderId ?? null,
  });

  /** Only the items not already in the chosen folder. */
  private readonly ciphersToMove = computed(() => {
    const folderId = this.folderId();
    return folderId == null ? [] : this.ciphers.filter((c) => folderIdOf(c) !== folderId);
  });

  protected readonly saveDisabled = computed(() => this.ciphersToMove().length === 0);

  protected readonly noFolderSelected = computed(() => this.folderId() === NO_FOLDER_ID);

  protected readonly someAlreadyInFolder = computed(() => {
    const moving = this.ciphersToMove().length;
    return moving > 0 && moving < this.ciphers.length;
  });

  protected cancel() {
    this.close(BulkMoveDialogResult.Canceled);
  }

  protected readonly submit = async () => {
    const folderId = this.folderId();
    const ciphersToMove = this.ciphersToMove();
    if (folderId == null || ciphersToMove.length === 0) {
      return;
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.moveManyWithServer(
      ciphersToMove.map((c) => c.id),
      folderId,
      activeUserId,
    );
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t(this.toastKey(folderId, ciphersToMove.length)),
    });
    this.close(BulkMoveDialogResult.Moved);
  };

  private toastKey(folderId: string, movedCount: number): string {
    if (folderId === NO_FOLDER_ID) {
      return movedCount === 1 ? "itemNowHasNoFolder" : "itemsNowHaveNoFolder";
    }
    return movedCount === 1 ? "itemAddedToFolder" : "itemsAddedToFolder";
  }

  private findSharedFolderId(): string | undefined {
    const folderIds = new Set(this.ciphers.map(folderIdOf));
    return folderIds.size === 1 ? [...folderIds][0] : undefined;
  }

  private close(result: BulkMoveDialogResult) {
    void this.dialogRef.close(result);
  }
}
