import {
  DefaultTwoFactorAuthComponentService,
  DuoLaunchAction,
  TwoFactorAuthComponentService,
} from "@bitwarden/auth/angular";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";

import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/popup/browser-popup-utils";
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
    // If we are in a single action popout, we don't need the popout anymore because the intent
    // is for the user to be left on the web vault screen which tells them to continue in
    // the browser extension (sidebar or popup).  We don't want the user to be left with a
    // floating, popped out extension which could be lost behind another window or minimized.
    // Currently, the popped out window thinks it is active and wouldn't time out which
    // leads to the security concern. So, we close the popped out extension to avoid this.
    const inSsoAuthResultPopout = BrowserPopupUtils.inSingleActionPopout(
      this.window,
      AuthPopoutType.ssoAuthResult,
    );
    if (inSsoAuthResultPopout) {
      await closeSsoAuthResultPopout();
      return true;
    }

    const inTwoFactorAuthWebAuthnPopout = BrowserPopupUtils.inSingleActionPopout(
      this.window,
      AuthPopoutType.twoFactorAuthWebAuthn,
    );

    if (inTwoFactorAuthWebAuthnPopout) {
      await closeTwoFactorAuthWebAuthnPopout();
      return true;
    }

    const inTwoFactorAuthEmailPopout = BrowserPopupUtils.inSingleActionPopout(
      this.window,
      AuthPopoutType.twoFactorAuthEmail,
    );

    if (inTwoFactorAuthEmailPopout) {
      await closeTwoFactorAuthEmailPopout();
      return true;
    }

    const inTwoFactorAuthDuoPopout = BrowserPopupUtils.inSingleActionPopout(
      this.window,
      AuthPopoutType.twoFactorAuthDuo,
    );
    if (inTwoFactorAuthDuoPopout) {
      await closeTwoFactorAuthDuoPopout();
      return true;
    }

    return false;
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

    if (inTwoFactorAuthDuoPopout) {
      return DuoLaunchAction.DIRECT_LAUNCH;
    }

    return DuoLaunchAction.SINGLE_ACTION_POPOUT;
  }
}
