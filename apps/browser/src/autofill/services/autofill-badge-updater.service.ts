import { combineLatest, distinctUntilChanged, map, mergeMap, of, Subject, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BadgeSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/badge-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTask, SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";

import { BadgeService } from "../../platform/badge/badge.service";
import { BadgeIcon } from "../../platform/badge/icon";
import { BadgeStatePriority } from "../../platform/badge/priority";
import { BrowserApi } from "../../platform/browser/browser-api";

const StateName = (tabId: number) => `autofill-badge-${tabId}`;

export class AutofillBadgeUpdaterService {
  private tabReplaced$ = new Subject<{ addedTab: chrome.tabs.Tab; removedTabId: number }>();
  private tabUpdated$ = new Subject<chrome.tabs.Tab>();
  private tabRemoved$ = new Subject<number>();

  private activeAccount$ = this.accountService.activeAccount$;

  private pendingTasks$ = this.activeAccount$.pipe(
    filterOutNullish(),
    switchMap((account) =>
      this.taskService
        .pendingTasks$(account.id)
        .pipe(
          map((tasks) => tasks.filter((t) => t.type === SecurityTaskType.UpdateAtRiskCredential)),
        ),
    ),
  );

  constructor(
    private badgeService: BadgeService,
    private accountService: AccountService,
    private cipherService: CipherService,
    private badgeSettingsService: BadgeSettingsServiceAbstraction,
    private logService: LogService,
    private taskService: TaskService,
  ) {
    const cipherViews$ = this.accountService.activeAccount$.pipe(
      switchMap((account) => (account?.id ? this.cipherService.cipherViews$(account?.id) : of([]))),
    );

    combineLatest({
      account: this.accountService.activeAccount$,
      enableBadgeCounter:
        this.badgeSettingsService.enableBadgeCounter$.pipe(distinctUntilChanged()),
      ciphers: cipherViews$,
      pendingTasks: this.pendingTasks$,
    })
      .pipe(
        mergeMap(async ({ account, enableBadgeCounter, pendingTasks }) => {
          if (!account) {
            return;
          }

          const tabs = await BrowserApi.tabsQuery({});
          for (const tab of tabs) {
            if (!tab.id) {
              continue;
            }

            // When the badge counter is disabled, a tab state may be applicable based on the pending tasks.
            if (enableBadgeCounter || pendingTasks.length > 0) {
              await this.setTabState(tab, account.id, enableBadgeCounter, pendingTasks);
            } else {
              await this.clearTabState(tab.id);
            }
          }
        }),
      )
      .subscribe();

    combineLatest({
      account: this.accountService.activeAccount$,
      enableBadgeCounter: this.badgeSettingsService.enableBadgeCounter$,
      replaced: this.tabReplaced$,
      ciphers: cipherViews$,
      pendingTasks: this.pendingTasks$,
    })
      .pipe(
        mergeMap(async ({ account, enableBadgeCounter, replaced, pendingTasks }) => {
          if (!account) {
            return;
          }

          await this.clearTabState(replaced.removedTabId);
          await this.setTabState(replaced.addedTab, account.id, enableBadgeCounter, pendingTasks);
        }),
      )
      .subscribe();

    combineLatest({
      account: this.accountService.activeAccount$,
      enableBadgeCounter: this.badgeSettingsService.enableBadgeCounter$,
      tab: this.tabUpdated$,
      ciphers: cipherViews$,
      pendingTasks: this.pendingTasks$,
    })
      .pipe(
        mergeMap(async ({ account, enableBadgeCounter, tab, pendingTasks }) => {
          if (!account) {
            return;
          }

          await this.setTabState(tab, account.id, enableBadgeCounter, pendingTasks);
        }),
      )
      .subscribe();

    combineLatest({
      account: this.accountService.activeAccount$,
      enableBadgeCounter: this.badgeSettingsService.enableBadgeCounter$,
      tabId: this.tabRemoved$,
      ciphers: cipherViews$,
    })
      .pipe(
        mergeMap(async ({ account, enableBadgeCounter, tabId }) => {
          if (!account || !enableBadgeCounter) {
            return;
          }

          await this.clearTabState(tabId);
        }),
      )
      .subscribe();
  }

  init() {
    BrowserApi.addListener(chrome.tabs.onReplaced, async (addedTabId, removedTabId) => {
      const newTab = await BrowserApi.getTab(addedTabId);
      if (!newTab) {
        this.logService.warning(
          `Tab replaced event received but new tab not found (id: ${addedTabId})`,
        );
        return;
      }

      this.tabReplaced$.next({
        removedTabId,
        addedTab: newTab,
      });
    });
    BrowserApi.addListener(chrome.tabs.onUpdated, (_, changeInfo, tab) => {
      if (changeInfo.url) {
        this.tabUpdated$.next(tab);
      }
    });
    BrowserApi.addListener(chrome.tabs.onRemoved, (tabId, _) => this.tabRemoved$.next(tabId));
  }

  private async setTabState(
    tab: chrome.tabs.Tab,
    userId: UserId,
    enableBadgeCounter: boolean,
    pendingTasks?: SecurityTask[],
  ) {
    if (!tab.id) {
      this.logService.warning("Tab event received but tab id is undefined");
      return;
    }

    const ciphers = tab.url ? await this.cipherService.getAllDecryptedForUrl(tab.url, userId) : [];
    const cipherCount = ciphers.length;

    const hasPendingTasksForTab = (pendingTasks ?? []).some((task) =>
      ciphers.some((cipher) => cipher.id === task.cipherId && !cipher.isDeleted),
    );

    const skipBadgeUpdate = !enableBadgeCounter && !hasPendingTasksForTab;

    if (cipherCount === 0 || skipBadgeUpdate) {
      await this.clearTabState(tab.id);
      return;
    }

    if (hasPendingTasksForTab) {
      await this.badgeService.setState(
        StateName(tab.id),
        BadgeStatePriority.High,
        {
          icon: BadgeIcon.Berry,
        },
        tab.id,
      );
      return;
    }

    const countText = cipherCount > 9 ? "9+" : cipherCount.toString();
    await this.badgeService.setState(
      StateName(tab.id),
      BadgeStatePriority.Default,
      {
        text: countText,
      },
      tab.id,
    );
  }

  private async clearTabState(tabId: number) {
    await this.badgeService.clearState(StateName(tabId));
  }
}
