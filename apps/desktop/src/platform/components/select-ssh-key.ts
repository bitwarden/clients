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
  RadioButtonModule,
  SearchModule,
} from "@bitwarden/components";

export interface SelectSshKeyParams {
  sshKeys: CipherView[];
  applicationName: string;
  namespace: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-select-ssh-key",
  templateUrl: "select-ssh-key.html",
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
    RadioButtonModule,
    SearchModule,
  ],
})
export class SelectSshKeyComponent {
  selectSshKeyForm = this.formBuilder.group({
    selectedKeyId: [null as string | null],
    searchText: [""],
  });

  filteredSshKeys: CipherView[] = [];

  constructor(
    @Inject(DIALOG_DATA) protected params: SelectSshKeyParams,
    private dialogRef: DialogRef<string | null>,
    private formBuilder: FormBuilder,
  ) {
    this.filteredSshKeys = params.sshKeys || [];

    // Subscribe to search text changes
    this.selectSshKeyForm.controls.searchText.valueChanges
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

  getKeyFingerprint(key: CipherView): string {
    return key.sshKey?.keyFingerprint || "";
  }

  static open(
    dialogService: DialogService,
    sshKeys: CipherView[],
    applicationName: string,
    namespace: string,
  ) {
    return dialogService.open<string | null, SelectSshKeyParams>(SelectSshKeyComponent, {
      data: {
        sshKeys,
        applicationName,
        namespace,
      },
    });
  }

  submit = async () => {
    const selectedKeyId = this.selectSshKeyForm.value.selectedKeyId;
    this.dialogRef.close(selectedKeyId);
  };

  cancel = () => {
    this.dialogRef.close(null);
  };
}
