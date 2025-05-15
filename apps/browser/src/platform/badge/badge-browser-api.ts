import { BrowserApi } from "../browser/browser-api";
import { BrowserPlatformUtilsService } from "../services/platform-utils/browser-platform-utils.service";

import { IconPaths } from "./state";

export interface RawBadgeState {
  text?: string;
  backgroundColor?: string;
  icon?: IconPaths;
}

export class BadgeBrowserApi {
  private badgeAction = BrowserApi.getBrowserAction();
  private sidebarAction = BrowserApi.getSidebarAction(self);

  async setState(state: RawBadgeState): Promise<void> {
    await this.setIcon(state.icon);
  }

  private setIcon(icon: IconPaths) {
    return Promise.all([this.setActionIcon(icon), this.setSidebarActionIcon(icon)]);
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

  private get useSyncApiCalls() {
    return BrowserPlatformUtilsService.isFirefox() || BrowserPlatformUtilsService.isSafari(self);
  }

  private isOperaSidebar(
    action: OperaSidebarAction | FirefoxSidebarAction,
  ): action is OperaSidebarAction {
    return action != null && (action as OperaSidebarAction).setBadgeText != null;
  }
}
