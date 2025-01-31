// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { ButtonModule, DialogService, MenuModule, NoItemsModule } from "@bitwarden/components";
import { AddEditFolderDialogComponent } from "@bitwarden/vault";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/popup/browser-popup-utils";
import { AddEditQueryParams } from "../add-edit/add-edit-v2.component";

export interface NewItemInitialValues {
  folderId?: string;
  organizationId?: OrganizationId;
  collectionId?: CollectionId;
}

@Component({
  selector: "app-new-item-dropdown",
  templateUrl: "new-item-dropdown-v2.component.html",
  standalone: true,
  imports: [NoItemsModule, JslibModule, CommonModule, ButtonModule, RouterLink, MenuModule],
})
export class NewItemDropdownV2Component implements OnInit {
  cipherType = CipherType;
  private tab?: chrome.tabs.Tab;
  /**
   * Optional initial values to pass to the add cipher form
   */
  @Input()
  initialValues: NewItemInitialValues;
  constructor(
    private router: Router,
    private dialogService: DialogService,
    private configService: ConfigService,
  ) {}

  sshKeysEnabled = false;

  async ngOnInit() {
    this.sshKeysEnabled = await this.configService.getFeatureFlag(FeatureFlag.SSHKeyVaultItem);
    this.tab = await BrowserApi.getTabFromCurrentWindow();
  }

  buildQueryParams(type: CipherType): AddEditQueryParams {
    const poppedOut = BrowserPopupUtils.inPopout(window);

    const loginDetails: { uri?: string; name?: string } = {};

    // When a Login Cipher is created and the extension is not popped out,
    // pass along the uri and name
    if (!poppedOut && type === CipherType.Login && this.tab) {
      loginDetails.uri = this.tab.url;
      loginDetails.name = Utils.getHostname(this.tab.url);
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
