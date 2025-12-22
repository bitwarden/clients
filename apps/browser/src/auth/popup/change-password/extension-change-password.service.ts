import {
  DefaultChangePasswordService,
  ChangePasswordService,
} from "@bitwarden/angular/auth/password-management/change-password";
import BrowserPopupUtils from "@bitwarden/browser/platform/browser/browser-popup-utils";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KeyService } from "@bitwarden/key-management";

import { BrowserApi } from "../../../platform/browser/browser-api";

export class ExtensionChangePasswordService
  extends DefaultChangePasswordService
  implements ChangePasswordService
{
  constructor(
    protected keyService: KeyService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private win: Window,
  ) {
    super(keyService, masterPasswordApiService, masterPasswordService);
  }
  closeBrowserExtensionPopout(): void {
    if (BrowserPopupUtils.inPopout(this.win)) {
      BrowserApi.closePopup(this.win);
    }
  }
}
