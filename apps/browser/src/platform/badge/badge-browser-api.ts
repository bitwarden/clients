import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { BrowserApi } from "../browser/browser-api";

import { BadgeIcon, IconPaths } from "./icon";

export interface RawBadgeState {
  text: string;
  backgroundColor: string;
  icon: BadgeIcon;
}

export class BadgeBrowserApi {
  private badgeAction = BrowserApi.getBrowserAction();
  private sidebarAction = BrowserApi.getSidebarAction(self);

  constructor(private platformUtilsService: PlatformUtilsService) {}

  async setState(state: RawBadgeState): Promise<void> {
    await Promise.all([
      this.setIcon(state.icon),
      this.setText(state.text),
      this.setBackgroundColor(state.backgroundColor),
    ]);
  }

  private setIcon(icon: IconPaths) {
    return Promise.all([this.setActionIcon(icon), this.setSidebarActionIcon(icon)]);
  }

  private setText(text: string) {
    return Promise.all([this.setActionText(text), this.setSideBarText(text)]);
  }

  private async setActionIcon(path: IconPaths) {
    if (!this.badgeAction?.setIcon) {
      return;
    }

    if (this.useSyncApiCalls) {
      await this.badgeAction.setIcon({ path });
    } else {
      await new Promise<void>((resolve) => this.badgeAction.setIcon({ path }, resolve));
    }
  }

  private async setSidebarActionIcon(path: IconPaths) {
    if (!this.sidebarAction?.setIcon) {
      return;
    }

    if ("opr" in self && BrowserApi.isManifestVersion(3)) {
      // setIcon API is currenly broken for Opera MV3 extensions
      // https://forums.opera.com/topic/75680/opr-sidebaraction-seticon-api-is-broken-access-to-extension-api-denied?_=1738349261570
      // The API currently crashes on MacOS
      return;
    }

    if (this.isOperaSidebar(this.sidebarAction)) {
      await new Promise<void>((resolve) =>
        (this.sidebarAction as OperaSidebarAction).setIcon({ path }, () => resolve()),
      );
    } else {
      await this.sidebarAction.setIcon({ path });
    }
  }

  private async setActionText(text: string) {
    if (this.badgeAction?.setBadgeText) {
      await this.badgeAction.setBadgeText({ text });
    }
  }

  private async setSideBarText(text: string) {
    if (!this.sidebarAction) {
      return;
    }

    if (this.isOperaSidebar(this.sidebarAction)) {
      this.sidebarAction.setBadgeText({ text });
    } else if (this.sidebarAction) {
      // Firefox
      const title = `Bitwarden${Utils.isNullOrEmpty(text) ? "" : ` [${text}]`}`;
      await this.sidebarAction.setTitle({ title });
    }
  }

  private async setBackgroundColor(color: string) {
    if (this.badgeAction && this.badgeAction?.setBadgeBackgroundColor) {
      await this.badgeAction.setBadgeBackgroundColor({ color });
    }
    if (this.sidebarAction && this.isOperaSidebar(this.sidebarAction)) {
      this.sidebarAction.setBadgeBackgroundColor({ color });
    }
  }

  private get useSyncApiCalls() {
    return this.platformUtilsService.isFirefox() || this.platformUtilsService.isSafari();
  }

  private isOperaSidebar(
    action: OperaSidebarAction | FirefoxSidebarAction,
  ): action is OperaSidebarAction {
    return action != null && (action as OperaSidebarAction).setBadgeText != null;
  }
}
