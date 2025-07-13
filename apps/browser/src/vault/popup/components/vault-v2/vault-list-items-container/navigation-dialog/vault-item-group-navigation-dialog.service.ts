import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import {
  KeyDefinition,
  StateProvider,
  VAULT_ITEM_GROUP_NAVIGATION_DIALOG,
} from "@bitwarden/common/platform/state";
import { DialogService } from "@bitwarden/components";

import { VaultItemGroupNavigationDialogComponent } from "./vault-item-group-navigation-dialog.component";

const VAULT_ITEM_GROUP_NAVIGATION_DIALOG_SHOWN = new KeyDefinition<boolean>(
  VAULT_ITEM_GROUP_NAVIGATION_DIALOG,
  "dialogShown",
  {
    deserializer: (obj) => obj,
  },
);

@Injectable({
  providedIn: "root",
})
export class VaultItemGroupNavigationDialogService {
  private dialogService = inject(DialogService);
  private shownState = inject(StateProvider).getGlobal(VAULT_ITEM_GROUP_NAVIGATION_DIALOG_SHOWN);

  /** Opens the dialog if it hasn't been opened before. */
  async openOnce() {
    if (await firstValueFrom(this.shownState.state$)) {
      return;
    }
    const dialogRef = this.dialogService.open(VaultItemGroupNavigationDialogComponent);
    await this.shownState.update(() => true);
    return dialogRef;
  }
}
