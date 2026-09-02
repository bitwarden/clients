import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
import { DialogService, IconModule, MenuModule } from "@bitwarden/components";
import { AddEditFolderDialogComponent, VaultFabComponent } from "@bitwarden/vault";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
import { AddEditQueryParams } from "../add-edit/add-edit.component";
import { NewItemInitialValues } from "../new-item-dropdown/new-item-dropdown.component";

@Component({
  selector: "app-vault-fab",
  templateUrl: "vault-fab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, CommonModule, VaultFabComponent, MenuModule, RouterLink, IconModule],
})
export class AppVaultFabComponent {
  readonly initialValues = input<NewItemInitialValues>();

  protected readonly cipherMenuItems = CIPHER_MENU_ITEMS;

  protected readonly useNewItemTypes = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.PM32009NewItemTypes),
    { initialValue: false },
  );

  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);

  private readonly tab?: chrome.tabs.Tab;

  constructor() {
    void BrowserApi.getTabFromCurrentWindow()?.then((tab) => (this.tab = tab));
  }

  protected buildQueryParams(type: CipherType): AddEditQueryParams {
    const poppedOut = BrowserPopupUtils.inPopout(window);
    const loginDetails: { prefillNameAndURIFromTab?: string } = {};

    if (!poppedOut && type === CipherType.Login && this.tab) {
      loginDetails.prefillNameAndURIFromTab = "true";
    }

    return {
      type: type.toString(),
      collectionId: this.initialValues()?.collectionId,
      organizationId: this.initialValues()?.organizationId,
      folderId: this.initialValues()?.folderId,
      ...loginDetails,
    };
  }

  protected navigateToNewItemPage(): void {
    void this.router.navigate(["/new-item"], {
      queryParams: {
        folderId: this.initialValues()?.folderId,
        organizationId: this.initialValues()?.organizationId,
        collectionId: this.initialValues()?.collectionId,
      },
    });
  }

  protected openFolderDialog(): void {
    AddEditFolderDialogComponent.open(this.dialogService);
  }
}
