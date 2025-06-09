import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { BrowserApi } from "../browser/browser-api";

import { BadgeIcon, IconPaths } from "./icon";

export interface RawBadgeState {
  tabId?: string;
  text: string;
  backgroundColor: string;
  icon: BadgeIcon;
}

export interface BadgeBrowserApi {
  setState(state: RawBadgeState, tabId?: number): Promise<void>;
  getTabs(): Promise<number[]>;
}

export class DefaultBadgeBrowserApi implements BadgeBrowserApi {
  private badgeAction = BrowserApi.getBrowserAction();
  private sidebarAction = BrowserApi.getSidebarAction(self);

  constructor(private platformUtilsService: PlatformUtilsService) {}

  async setState(state: RawBadgeState, tabId?: number): Promise<void> {
    await Promise.all([
      state.backgroundColor !== undefined ? this.setIcon(state.icon, tabId) : undefined,
      this.setText(state.text, tabId),
      state.backgroundColor !== undefined
        ? this.setBackgroundColor(state.backgroundColor, tabId)
        : undefined,
    ]);
  }

  async getTabs(): Promise<number[]> {
    return (await BrowserApi.tabsQuery({})).map((tab) => tab.id).filter((tab) => tab !== undefined);
  }

  private setIcon(icon: IconPaths, tabId?: number) {
    return Promise.all([this.setActionIcon(icon, tabId), this.setSidebarActionIcon(icon, tabId)]);
  }

  private setText(text: string, tabId?: number) {
    return Promise.all([this.setActionText(text, tabId), this.setSideBarText(text, tabId)]);
  }

  private async setActionIcon(path: IconPaths, tabId?: number) {
    if (!this.badgeAction?.setIcon) {
      return;
    }

    if (this.useSyncApiCalls) {
      await this.badgeAction.setIcon({ path, tabId });
    } else {
      await new Promise<void>((resolve) => this.badgeAction.setIcon({ path, tabId }, resolve));
    }
  }

  private async setSidebarActionIcon(path: IconPaths, tabId?: number) {
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
        (this.sidebarAction as OperaSidebarAction).setIcon({ path, tabId }, () => resolve()),
      );
    } else {
      await this.sidebarAction.setIcon({ path, tabId });
    }
  }

  private async setActionText(text: string, tabId?: number) {
    if (this.badgeAction?.setBadgeText) {
      await this.badgeAction.setBadgeText({ text, tabId });
    }
  }

  private async setSideBarText(text: string, tabId?: number) {
    if (!this.sidebarAction) {
      return;
    }

    if (this.isOperaSidebar(this.sidebarAction)) {
      this.sidebarAction.setBadgeText({ text, tabId });
    } else if (this.sidebarAction) {
      // Firefox
      const title = `Bitwarden${Utils.isNullOrEmpty(text) ? "" : ` [${text}]`}`;
      await this.sidebarAction.setTitle({ title, tabId });
    }
  }

  private async setBackgroundColor(color: string, tabId?: number) {
    if (this.badgeAction && this.badgeAction?.setBadgeBackgroundColor) {
      await this.badgeAction.setBadgeBackgroundColor({ color, tabId });
    }
    if (this.sidebarAction && this.isOperaSidebar(this.sidebarAction)) {
      this.sidebarAction.setBadgeBackgroundColor({ color, tabId });
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
