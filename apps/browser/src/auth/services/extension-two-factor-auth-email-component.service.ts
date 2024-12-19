import {
  DefaultTwoFactorAuthEmailComponentService,
  TwoFactorAuthEmailComponentService,
} from "@bitwarden/auth/angular";
import { DialogService } from "@bitwarden/components";

import BrowserPopupUtils from "../../platform/popup/browser-popup-utils";

// TODO: popup state persistence should eventually remove the need for this service
export class ExtensionTwoFactorAuthEmailComponentService
  extends DefaultTwoFactorAuthEmailComponentService
  implements TwoFactorAuthEmailComponentService
{
  constructor(
    private dialogService: DialogService,
    private window: Window,
  ) {
    super();
  }

  async openPopoutIfApprovedForEmail2fa(): Promise<void> {
    if (BrowserPopupUtils.inPopup(this.window)) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "warning" },
        content: { key: "popup2faCloseMessage" },
        type: "warning",
      });
      if (confirmed) {
        await BrowserPopupUtils.openCurrentPagePopout(this.window);
      }
    }
  }
}
