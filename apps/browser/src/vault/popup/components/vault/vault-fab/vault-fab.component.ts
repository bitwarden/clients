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

export interface FabNewItemInitialValues {
  folderIds?: string[];
  organizationIds?: string[];
  collectionIds?: string[];
}

@Component({
  selector: "app-vault-fab",
  templateUrl: "vault-fab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, CommonModule, VaultFabComponent, MenuModule, RouterLink, IconModule],
})
export class AppVaultFabComponent {
  readonly initialValues = input<FabNewItemInitialValues>();

  protected readonly cipherMenuItems = CIPHER_MENU_ITEMS;

  protected readonly useNewItemTypes = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.PM32009NewItemTypes),
    { initialValue: false },
  );

  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);

  /* eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties */
  private tab?: chrome.tabs.Tab;

  constructor() {
    void BrowserApi.getTabFromCurrentWindow()?.then((tab) => (this.tab = tab));
  }

  protected buildQueryParams(type: CipherType): AddEditQueryParams {
    const poppedOut = BrowserPopupUtils.inPopout(window);
    const loginDetails: { prefillNameAndURIFromTab?: string } = {};

    if (!poppedOut && type === CipherType.Login && this.tab) {
      loginDetails.prefillNameAndURIFromTab = "true";
    }

    const { organizationId, collectionIds, folderId } = this.getInitialValues();
    return {
      type: type.toString(),
      collectionIds: collectionIds,
      organizationId: organizationId,
      folderId: folderId,
      ...loginDetails,
    };
  }

  protected navigateToNewItemPage(): void {
    const { folderId, organizationId, collectionIds } = this.getInitialValues();
    void this.router.navigate(["/new-item"], {
      queryParams: {
        folderId: folderId,
        organizationId: organizationId,
        collectionIds: collectionIds,
      },
    });
  }

  protected openFolderDialog(): void {
    AddEditFolderDialogComponent.open(this.dialogService);
  }

  private getInitialValues() {
    // Vaults can have multiple values, when that occurs do not prefill the value.
    const onlyOneVault = (this.initialValues()?.organizationIds?.length ?? 0) === 1;
    const organizationId = onlyOneVault ? this.initialValues()?.organizationIds?.[0] : undefined;
    const collectionIds = onlyOneVault ? this.initialValues()?.collectionIds : undefined;

    const folderId =
      (this.initialValues().folderIds?.length ?? 0) === 1
        ? this.initialValues()?.folderIds?.[0]
        : undefined;

    return {
      organizationId: organizationId as unknown as string,
      collectionIds: collectionIds?.join(","),
      folderId: folderId,
    };
  }
}
