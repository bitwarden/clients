import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  DialogService,
  CalloutModule,
  SearchModule,
  CheckboxModule,
} from "@bitwarden/components";

export interface LoadSomeKeysParams {
  sshKeys: CipherView[];
  currentlySelectedIds?: string[];
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-load-some-keys",
  templateUrl: "load-some-keys.html",
  imports: [
    DialogModule,
    CommonModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    FormFieldModule,
    CalloutModule,
    SearchModule,
    CheckboxModule,
  ],
})
export class LoadSomeKeysComponent {
  loadSomeKeysForm = this.formBuilder.group({
    searchText: [""],
  });

  filteredSshKeys: CipherView[] = [];
  selectedKeyIds: Set<string> = new Set();

  constructor(
    @Inject(DIALOG_DATA) protected params: LoadSomeKeysParams,
    private dialogRef: DialogRef<string[] | null>,
    private formBuilder: FormBuilder,
  ) {
    this.filteredSshKeys = params.sshKeys || [];

    // Pre-populate with currently selected keys
    if (params.currentlySelectedIds) {
      this.selectedKeyIds = new Set(params.currentlySelectedIds);
    }

    // Subscribe to search text changes
    this.loadSomeKeysForm.controls.searchText.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((searchText) => {
        this.filterSshKeys(searchText || "");
      });
  }

  private filterSshKeys(searchText: string): void {
    if (!searchText) {
      this.filteredSshKeys = this.params.sshKeys;
      return;
    }

    const lowerSearchText = searchText.toLowerCase();
    this.filteredSshKeys = this.params.sshKeys.filter((key) => {
      return (
        key.name?.toLowerCase().includes(lowerSearchText) ||
        key.sshKey?.publicKey?.toLowerCase().includes(lowerSearchText) ||
        key.sshKey?.keyFingerprint?.toLowerCase().includes(lowerSearchText)
      );
    });
  }

  toggleKeySelection(keyId: string): void {
    if (this.selectedKeyIds.has(keyId)) {
      this.selectedKeyIds.delete(keyId);
    } else {
      this.selectedKeyIds.add(keyId);
    }
  }

  isKeySelected(keyId: string): boolean {
    return this.selectedKeyIds.has(keyId);
  }

  getKeyFingerprint(key: CipherView): string {
    return key.sshKey?.keyFingerprint || "";
  }

  static open(
    dialogService: DialogService,
    sshKeys: CipherView[],
    currentlySelectedIds?: string[],
  ) {
    return dialogService.open<string[] | null, LoadSomeKeysParams>(LoadSomeKeysComponent, {
      data: {
        sshKeys,
        currentlySelectedIds,
      },
    });
  }

  submit = async () => {
    const selectedIds = Array.from(this.selectedKeyIds);
    this.dialogRef.close(selectedIds);
  };

  cancel = () => {
    this.dialogRef.close(null);
  };
}
