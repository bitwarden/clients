import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTask, TaskService } from "@bitwarden/common/vault/tasks";
import { LogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

import { BadgeService } from "../../platform/badge/badge.service";
import { BadgeIcon } from "../../platform/badge/icon";
import { BadgeStatePriority } from "../../platform/badge/priority";
import { Unset } from "../../platform/badge/state";
import { BrowserApi } from "../../platform/browser/browser-api";

import { AtRiskCipherBadgeUpdaterService } from "./at-risk-cipher-badge-updater.service";

describe("AtRiskCipherBadgeUpdaterService", () => {
  let service: AtRiskCipherBadgeUpdaterService;

  let setState: jest.Mock;
  let clearState: jest.Mock;
  let warning: jest.Mock;
  let getAllDecryptedForUrl: jest.Mock;
  let getTab: jest.Mock;
  let addListener: jest.Mock;

  const activeAccount$ = new BehaviorSubject({ id: "test-account-id" });
  const cipherViews$ = new BehaviorSubject([]);
  const pendingTasks$ = new BehaviorSubject<SecurityTask[]>([]);
  const userId = "test-user-id" as UserId;

  beforeEach(async () => {
    setState = jest.fn().mockResolvedValue(undefined);
    clearState = jest.fn().mockResolvedValue(undefined);
    warning = jest.fn();
    getAllDecryptedForUrl = jest.fn().mockResolvedValue([]);
    getTab = jest.fn();
    addListener = jest.fn();

    jest.spyOn(BrowserApi, "addListener").mockImplementation(addListener);
    jest.spyOn(BrowserApi, "getTab").mockImplementation(getTab);

    service = new AtRiskCipherBadgeUpdaterService(
      { setState, clearState } as unknown as BadgeService,
      { activeAccount$ } as unknown as AccountService,
      { cipherViews$, getAllDecryptedForUrl } as unknown as CipherService,
      { warning } as unknown as LogService,
      { pendingTasks$ } as unknown as TaskService,
    );

    await service.init();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("clears the tab state when there are no ciphers and no pending tasks", async () => {
    const tab = { id: 1 } as chrome.tabs.Tab;

    await service["setTabState"](tab, userId, []);

    expect(clearState).toHaveBeenCalledWith("at-risk-cipher-badge-1");
  });

  it("sets state when there are pending tasks for the tab", async () => {
    const tab = { id: 3, url: "https://bitwarden.com" } as chrome.tabs.Tab;
    const pendingTasks: SecurityTask[] = [{ id: "task1", cipherId: "cipher1" } as SecurityTask];
    getAllDecryptedForUrl.mockResolvedValueOnce([{ id: "cipher1" }]);

    await service["setTabState"](tab, userId, pendingTasks);

    expect(setState).toHaveBeenCalledWith(
      "at-risk-cipher-badge-3",
      BadgeStatePriority.High,
      {
        icon: BadgeIcon.Berry,
        text: Unset,
        backgroundColor: Unset,
      },
      3,
    );
  });
});
