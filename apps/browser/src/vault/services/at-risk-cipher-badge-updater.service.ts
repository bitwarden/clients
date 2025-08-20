import { combineLatest, map, mergeMap, of, Subject, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTask, SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";

import { BadgeService } from "../../platform/badge/badge.service";
import { BadgeIcon } from "../../platform/badge/icon";
import { BadgeStatePriority } from "../../platform/badge/priority";
import { Unset } from "../../platform/badge/state";
import { BrowserApi } from "../../platform/browser/browser-api";

const StateName = (tabId: number) => `at-risk-cipher-badge-${tabId}`;

export class AtRiskCipherBadgeUpdaterService {
  private tabReplaced$ = new Subject<{ addedTab: chrome.tabs.Tab; removedTabId: number }>();
  private tabUpdated$ = new Subject<chrome.tabs.Tab>();
  private tabRemoved$ = new Subject<number>();
  private tabActivated$ = new Subject<chrome.tabs.Tab>();

  private activeAccount$ = this.accountService.activeAccount$;
  private userId$ = this.activeAccount$.pipe(getOptionalUserId, filterOutNullish());

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
    private logService: LogService,
    private taskService: TaskService,
  ) {
    const cipherViews$ = this.activeAccount$.pipe(
      switchMap((account) => (account?.id ? this.cipherService.cipherViews$(account?.id) : of([]))),
    );

    combineLatest({
      replaced: this.tabReplaced$,
      userId: this.userId$,
      pendingTasks: this.pendingTasks$,
      ciphers: cipherViews$,
    })
      .pipe(
        mergeMap(async ({ userId, replaced, pendingTasks }) => {
          await this.clearTabState(replaced.removedTabId);
          await this.setTabState(replaced.addedTab, userId, pendingTasks);
        }),
      )
      .subscribe(() => {});

    combineLatest({
      tab: this.tabActivated$,
      userId: this.userId$,
      pendingTasks: this.pendingTasks$,
      ciphers: cipherViews$,
    })
      .pipe(
        mergeMap(async ({ userId, tab, pendingTasks }) => {
          await this.setTabState(tab, userId, pendingTasks);
        }),
      )
      .subscribe();

    combineLatest({
      tab: this.tabUpdated$,
      userId: this.userId$,
      pendingTasks: this.pendingTasks$,
      ciphers: cipherViews$,
    })
      .pipe(
        mergeMap(async ({ userId, tab, pendingTasks }) => {
          await this.setTabState(tab, userId, pendingTasks);
        }),
      )
      .subscribe();

    this.tabRemoved$
      .pipe(
        mergeMap(async (tabId) => {
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

    BrowserApi.addListener(chrome.tabs.onActivated, async (activeInfo) => {
      const tab = await BrowserApi.getTab(activeInfo.tabId);
      if (!tab) {
        this.logService.warning(
          `Tab activated event received but tab not found (id: ${activeInfo.tabId})`,
        );
        return;
      }

      this.tabActivated$.next(tab);
    });

    BrowserApi.addListener(chrome.tabs.onRemoved, (tabId, _) => this.tabRemoved$.next(tabId));
  }

  /** Sets the pending task state for the tab */
  private async setTabState(tab: chrome.tabs.Tab, userId: UserId, pendingTasks: SecurityTask[]) {
    if (!tab.id) {
      this.logService.warning("Tab event received but tab id is undefined");
      return;
    }

    const ciphers = tab.url
      ? await this.cipherService.getAllDecryptedForUrl(tab.url, userId, [], undefined, true)
      : [];

    const hasPendingTasksForTab = pendingTasks.some((task) =>
      ciphers.some((cipher) => cipher.id === task.cipherId && !cipher.isDeleted),
    );

    if (!hasPendingTasksForTab) {
      await this.clearTabState(tab.id);
      return;
    }

    await this.badgeService.setState(
      StateName(tab.id),
      BadgeStatePriority.High,
      {
        icon: BadgeIcon.Berry,
        // Unset text and background color to use default badge appearance
        text: Unset,
        backgroundColor: Unset,
      },
      tab.id,
    );
  }

  /** Clears the pending task state from a tab */
  private async clearTabState(tabId: number) {
    await this.badgeService.clearState(StateName(tabId));
  }
}
