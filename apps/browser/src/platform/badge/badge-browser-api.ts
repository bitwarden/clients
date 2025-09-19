import {
  concat,
  concatMap,
  defer,
  filter,
  map,
  merge,
  Observable,
  of,
  pairwise,
  shareReplay,
  switchMap,
} from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { BrowserApi } from "../browser/browser-api";
import { fromChromeEvent } from "../browser/from-chrome-event";

import { BadgeIcon, IconPaths } from "./icon";

export interface RawBadgeState {
  tabId?: string;
  text: string;
  backgroundColor: string;
  icon: BadgeIcon;
}

export interface Tab {
  tabId: number;
  url: string;
}

function tabFromChromeTab(tab: chrome.tabs.Tab): Tab {
  return {
    tabId: tab.id!,
    url: tab.url!,
  };
}

export interface BadgeBrowserApi {
  /**
   * An observable that emits all currently active tabs whenever one or more active tabs change.
   */
  activeTabs$: Observable<Tab[]>;

  /**
   * An observable that emits tab events such as updates and activations.
   */
  tabEvents$: Observable<TabEvent>;

  /**
   * Set the badge state for a specific tab.
   * If the tabId is undefined the state will be applied to the browser action in general.
   */
  setState(state: RawBadgeState, tabId?: number): Promise<void>;
}

export type TabEvent =
  | {
      type: "updated";
      tab: Tab;
    }
  | {
      type: "activated";
      tab: Tab;
    }
  | {
      type: "deactivated";
      tabId: number;
    };

export class DefaultBadgeBrowserApi implements BadgeBrowserApi {
  private badgeAction = BrowserApi.getBrowserAction();
  private sidebarAction = BrowserApi.getSidebarAction(self);

  private onTabActivated$ = fromChromeEvent(chrome.tabs.onActivated).pipe(
    map(([activeInfo]) => activeInfo),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private createdOrUpdatedTabEvents$ = concat(
    defer(async () => await this.getActiveTabs()).pipe(
      switchMap((activeTabs) => {
        const tabEvents: TabEvent[] = activeTabs.map((tab) => ({
          type: "activated",
          tab,
        }));
        return of(...tabEvents);
      }),
    ),
    merge(
      this.onTabActivated$.pipe(
        switchMap(async (activeInfo) => await BrowserApi.getTab(activeInfo.tabId)),
        filter(
          (tab): tab is chrome.tabs.Tab =>
            !(tab == undefined || tab.id == undefined || tab.url == undefined),
        ),
        switchMap(async (tab) => {
          return { type: "activated", tab: tabFromChromeTab(tab) } satisfies TabEvent;
        }),
      ),
      fromChromeEvent(chrome.tabs.onUpdated).pipe(
        filter(
          ([_, changeInfo]) =>
            // Only emit if the url was updated
            changeInfo.url != undefined,
        ),
        map(
          ([_tabId, _changeInfo, tab]) =>
            ({ type: "updated", tab: tabFromChromeTab(tab) }) satisfies TabEvent,
        ),
      ),
      fromChromeEvent(chrome.webNavigation.onCommitted).pipe(
        filter(([details]) => details.transitionType === "reload"),
        map(([details]) => {
          return {
            type: "updated",
            tab: { tabId: details.tabId, url: details.url },
          } satisfies TabEvent;
        }),
      ),
      // NOTE: We're only sharing the active tab changes, not the full list of active tabs.
      // This is so that any new subscriber will get the latest active tabs immediately, but
      // doesn't re-subscribe to chrome events.
    ).pipe(shareReplay({ bufferSize: 1, refCount: true })),
  );

  tabEvents$ = merge(
    this.createdOrUpdatedTabEvents$,
    this.createdOrUpdatedTabEvents$.pipe(
      concatMap(async () => {
        return this.getActiveTabs();
      }),
      pairwise(),
      map(([previousTabs, currentTabs]) => {
        const previousTabIds = previousTabs.map((t) => t.tabId);
        const currentTabIds = currentTabs.map((t) => t.tabId);

        const deactivatedTabIds = previousTabIds.filter((id) => !currentTabIds.includes(id));

        return deactivatedTabIds.map(
          (tabId) =>
            ({
              type: "deactivated",
              tabId,
            }) satisfies TabEvent,
        );
      }),
      switchMap((events) => of(...events)),
    ),
  );

  activeTabs$ = this.tabEvents$.pipe(
    concatMap(async () => {
      return this.getActiveTabs();
    }),
  );

  private async getActiveTabs(): Promise<Tab[]> {
    const tabs = await BrowserApi.getActiveTabs();
    return tabs.filter((tab) => tab.id != undefined && tab.url != undefined).map(tabFromChromeTab);
  }

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
