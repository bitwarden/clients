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

  async extendPopupWidthIfRequired(selected2faProviderType: TwoFactorProviderType): Promise<void> {
    // WebAuthn prompt appears inside the popup on linux, and requires a larger popup width
    // than usual to avoid cutting off the dialog.
    const isLinux = await this.isLinux();
    if (selected2faProviderType === TwoFactorProviderType.WebAuthn && isLinux) {
      document.body.classList.add("linux-webauthn");
    }
  }

  removePopupWidthExtension(): void {
    document.body.classList.remove("linux-webauthn");
  }

  reloadOpenWindows(): void {
    // Force sidebars (FF && Opera) to reload while exempting current window
    // because we are just going to close the current window if it is in a popout
    // or navigate forward if it is in the popup
    BrowserApi.reloadOpenWindows(true);
  }

  async closeSingleActionPopouts(): Promise<boolean> {
    // Close any auth-related single-action popouts that are open. The popout may live in a
    // different window than the current view (e.g., user expanded the extension during 2FA), so
    // we close by key unconditionally; `closeSingleActionPopout` is a no-op if no matching tab
    // exists. The boolean return reports whether the current view itself was one of those
    // popouts, so callers can skip navigating a view that's about to be torn down.
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
