// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { combineLatest, map, Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherMenuItem, CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
import { ButtonModule, DialogService, MenuModule, NoItemsModule } from "@bitwarden/components";
import { AddEditFolderDialogComponent } from "@bitwarden/vault";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
import { AddEditQueryParams } from "../add-edit/add-edit.component";

export interface NewItemInitialValues {
  folderId?: string;
  organizationId?: OrganizationId;
  collectionId?: CollectionId;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-new-item-dropdown",
  templateUrl: "new-item-dropdown.component.html",
  imports: [NoItemsModule, JslibModule, CommonModule, ButtonModule, RouterLink, MenuModule],
})
export class NewItemDropdownComponent implements OnInit {
  cipherType = CipherType;
  private tab?: chrome.tabs.Tab;
  /**
   * Optional initial values to pass to the add cipher form
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  initialValues: NewItemInitialValues;

  /**
   * Observable of cipher menu items that are not restricted by policy
   */
  readonly cipherMenuItems$: Observable<CipherMenuItem[]> = combineLatest([
    this.restrictedItemTypeService.restricted$,
    this.configService.getFeatureFlag$(FeatureFlag.PM32009_NewItemTypes),
  ]).pipe(
    map(([restrictedTypes, canCreateBankAccount]) => {
      const restrictedTypeArr = restrictedTypes.map((item) => item.cipherType);

      return CIPHER_MENU_ITEMS.filter((menuItem) => {
        if (!canCreateBankAccount && menuItem.type === CipherType.BankAccount) {
          return false;
        }
        return !restrictedTypeArr.includes(menuItem.type);
      });
    }),
  );

  constructor(
    private dialogService: DialogService,
    private restrictedItemTypeService: RestrictedItemTypesService,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    this.tab = await BrowserApi.getTabFromCurrentWindow();
  }

  buildQueryParams(type: CipherType): AddEditQueryParams {
    const poppedOut = BrowserPopupUtils.inPopout(window);

    const loginDetails: { prefillNameAndURIFromTab?: string } = {};

    // When a Login Cipher is created and the extension is not popped out,
    // pass along the uri and name
    if (!poppedOut && type === CipherType.Login && this.tab) {
      loginDetails.prefillNameAndURIFromTab = "true";
    }

    return {
      type: type.toString(),
      collectionId: this.initialValues?.collectionId,
      organizationId: this.initialValues?.organizationId,
      folderId: this.initialValues?.folderId,
      ...loginDetails,
    };
  }

  openFolderDialog() {
    AddEditFolderDialogComponent.open(this.dialogService);
  }
}
