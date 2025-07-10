import {
  DefaultTwoFactorAuthEmailComponentService,
  TwoFactorAuthEmailComponentService,
} from "@bitwarden/auth/angular";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogService } from "@bitwarden/components";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { openTwoFactorAuthEmailPopout } from "../../auth/popup/utils/auth-popout-window";
import BrowserPopupUtils from "../../platform/browser/browser-popup-utils";

// TODO: popup state persistence should eventually remove the need for this service
export class ExtensionTwoFactorAuthEmailComponentService
  extends DefaultTwoFactorAuthEmailComponentService
  implements TwoFactorAuthEmailComponentService
{
  constructor(
    private dialogService: DialogService,
    private window: Window,
    private configService: ConfigService,
  ) {
    super();
  }

  async openPopoutIfApprovedForEmail2fa(): Promise<void> {
    const isTwoFactorFormPersistenceEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM9115_TwoFactorExtensionDataPersistence,
    );

    if (isTwoFactorFormPersistenceEnabled) {
      // If the feature flag is enabled, we don't need to prompt the user to open the popout
      return;
    }

    if (BrowserPopupUtils.inPopup(this.window)) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "warning" },
        content: { key: "popup2faCloseMessage" },
        type: "warning",
      });
      if (confirmed) {
        await openTwoFactorAuthEmailPopout();
        this.window.close();
      }
    }
  }
}
