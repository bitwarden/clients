import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
import { BitwardenIcon, DialogService, IconModule, MenuModule } from "@bitwarden/components";
import {
  AddEditFolderDialogComponent,
  MY_VAULT,
  NO_FOLDER,
  VaultFabComponent,
} from "@bitwarden/vault";

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

  /** Organizations available to the user */
  readonly organizations = input<Organization[]>([]);

  /** Collections available to the user */
  readonly collections = input<CollectionView[]>([]);

  private readonly restrictedItemTypesService = inject(RestrictedItemTypesService);

  protected readonly cipherMenuItems = toSignal(
    this.restrictedItemTypesService.restricted$.pipe(
      map((restricted) =>
        CIPHER_MENU_ITEMS.filter((item) => !restricted.some((r) => r.cipherType === item.type)).map(
          (item) => ({ ...item, icon: item.icon as BitwardenIcon }),
        ),
      ),
    ),
    { initialValue: [] },
  );

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
    // MY_VAULT is a sentinel for personal ownership — not a real org ID.
    // Keep the raw list to distinguish "no filter active" from "My Vault selected".
    const rawOrganizationIds = this.initialValues()?.organizationIds ?? [];
    const organizationIds = rawOrganizationIds.filter((id) => id !== MY_VAULT);

    const onlyOneOrg = organizationIds.length === 1;
    let organizationId = onlyOneOrg ? organizationIds[0] : undefined;

    // NO_FOLDER is a sentinel for "items with no folder" — not a real folder ID.
    const folderIds = this.initialValues()?.folderIds?.filter((id) => id !== NO_FOLDER) ?? [];
    const folderId = folderIds.length === 1 ? folderIds[0] : undefined;

    let collectionIds = this.initialValues()?.collectionIds ?? [];

    if (organizationId) {
      // Org is known — verify all selected collections belong to it.
      const allBelongToOrg = collectionIds.every((id) =>
        this.collections().some(
          (collection) => collection.id === id && collection.organizationId === organizationId,
        ),
      );
      if (!allBelongToOrg) {
        collectionIds = [];
      }
    } else if (rawOrganizationIds.length === 0 && collectionIds.length > 0) {
      // No org filter active — try to infer org from the selected collections.
      // All collections must share the same org for the inference to be unambiguous.
      const startingOrgId = this.collections().find((c) =>
        collectionIds.includes(c.id),
      )?.organizationId;

      const allSameOrg =
        startingOrgId != null &&
        collectionIds.every((id) =>
          this.collections().some((c) => c.id === id && c.organizationId === startingOrgId),
        );

      if (allSameOrg) {
        organizationId = this.organizations().find((o) => o.id === startingOrgId)?.id;
      } else {
        collectionIds = [];
      }
    } else {
      // Multiple orgs or MY_VAULT selected — can't logically determine the correct org, clear collections.
      collectionIds = [];
    }

    return {
      organizationId,
      collectionIds: collectionIds.length ? collectionIds.join(",") : undefined,
      folderId,
    };
  }
}
