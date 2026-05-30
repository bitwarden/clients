import {
  DefaultTwoFactorAuthComponentService,
  DuoLaunchAction,
  TwoFactorAuthComponentService,
} from "@bitwarden/auth/angular";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";

import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/browser/browser-popup-utils";
// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import {
  AuthPopoutType,
  closeSsoAuthResultPopout,
  closeTwoFactorAuthDuoPopout,
  closeTwoFactorAuthEmailPopout,
  closeTwoFactorAuthWebAuthnPopout,
} from "../popup/utils/auth-popout-window";

export class ExtensionTwoFactorAuthComponentService
  extends DefaultTwoFactorAuthComponentService
  implements TwoFactorAuthComponentService
{
  constructor(private window: Window) {
    super();
  }

  shouldCheckForWebAuthnQueryParamResponse(): boolean {
    return true;
  }

  /**
   * Adds a CSS class that widens the popup when needed for the WebAuthn 2FA prompt.
   *
   * The WebAuthn prompt appears inside the popup on Linux, and requires a larger popup width
   * than usual to avoid cutting off the dialog.
   */
  async extendPopupWidthIfRequired(selected2faProviderType: TwoFactorProviderType): Promise<void> {
    const isLinux = await this.isLinux();
    if (selected2faProviderType === TwoFactorProviderType.WebAuthn && isLinux) {
      document.body.classList.add("linux-webauthn");
    }
  }

  removePopupWidthExtension(): void {
    document.body.classList.remove("linux-webauthn");
  }

  /**
   * Reloads all extension views except the current one.
   *
   * Forces sidebars (Firefox and Opera) to reload while exempting the current window, because
   * we are just going to close the current window if it is in a popout or navigate forward if
   * it is in the popup.
   */
  reloadOpenWindows(): void {
    BrowserApi.reloadOpenWindows(true);
  }

  /**
   * Closes any auth-related single-action popouts that are open.
   * @returns `true` if the current view itself is one of those popouts, so callers can skip
   *   navigating a view that's about to be torn down.
   */
  async closeSingleActionPopouts(): Promise<boolean> {
    const authPopouts = [
      { type: AuthPopoutType.ssoAuthResult, close: closeSsoAuthResultPopout },
      { type: AuthPopoutType.twoFactorAuthWebAuthn, close: closeTwoFactorAuthWebAuthnPopout },
      { type: AuthPopoutType.twoFactorAuthEmail, close: closeTwoFactorAuthEmailPopout },
      { type: AuthPopoutType.twoFactorAuthDuo, close: closeTwoFactorAuthDuoPopout },
    ];

    const currentViewIsInAuthPopout = authPopouts.some(({ type }) =>
      BrowserPopupUtils.inSingleActionPopout(this.window, type),
    );

    await Promise.all(authPopouts.map(({ close }) => close()));

    return currentViewIsInAuthPopout;
  }

  private async isLinux(): Promise<boolean> {
    const platformInfo = await BrowserApi.getPlatformInfo();
    return platformInfo.os === "linux";
  }

  determineDuoLaunchAction(): DuoLaunchAction {
    const inTwoFactorAuthDuoPopout = BrowserPopupUtils.inSingleActionPopout(
      this.window,
      AuthPopoutType.twoFactorAuthDuo,
    );

    const inPopout = BrowserPopupUtils.inPopout(this.window);

    if (inTwoFactorAuthDuoPopout || inPopout) {
      return DuoLaunchAction.DIRECT_LAUNCH;
    }

    return DuoLaunchAction.SINGLE_ACTION_POPOUT;
  }
}
