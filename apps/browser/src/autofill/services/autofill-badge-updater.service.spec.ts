import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BadgeSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/badge-settings.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTask, TaskService } from "@bitwarden/common/vault/tasks";
import { LogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

import { BadgeService } from "../../platform/badge/badge.service";
import { BadgeIcon } from "../../platform/badge/icon";
import { BadgeStatePriority } from "../../platform/badge/priority";

import { AutofillBadgeUpdaterService } from "./autofill-badge-updater.service";

describe("AutofillBadgeUpdaterService", () => {
  let service: AutofillBadgeUpdaterService;

  let setState: jest.Mock;
  let clearState: jest.Mock;
  let warning: jest.Mock;
  let getAllDecryptedForUrl: jest.Mock;

  const activeAccount$ = new BehaviorSubject({ id: "test-account-id" });
  const cipherViews$ = new BehaviorSubject([]);
  const enableBadgeCounter$ = new BehaviorSubject(true);
  const pendingTasks$ = new BehaviorSubject([]);

  beforeEach(() => {
    setState = jest.fn().mockResolvedValue(undefined);
    clearState = jest.fn().mockResolvedValue(undefined);
    warning = jest.fn();
    getAllDecryptedForUrl = jest.fn().mockResolvedValue([]);

    service = new AutofillBadgeUpdaterService(
      { setState, clearState } as unknown as BadgeService,
      { activeAccount$ } as unknown as AccountService,
      { cipherViews$, getAllDecryptedForUrl } as unknown as CipherService,
      { enableBadgeCounter$ } as unknown as BadgeSettingsServiceAbstraction,
      { warning } as unknown as LogService,
      { pendingTasks$ } as unknown as TaskService,
    );
  });

  describe("setTabState", () => {
    const userId = "test-user-id" as UserId;

    it("clears the tab state when there are no ciphers and no pending tasks", async () => {
      const tab = { id: 1 } as chrome.tabs.Tab;

      await service["setTabState"](tab, userId, true, []);

      expect(clearState).toHaveBeenCalledWith("autofill-badge-1");
    });

    it("clears the tab state when the enableBadgeCounter is false and no pending tasks", async () => {
      const tab = { id: 2, url: "https://bitwarden.com" } as chrome.tabs.Tab;
      getAllDecryptedForUrl.mockResolvedValueOnce([{ id: "cipher1" }]);

      await service["setTabState"](tab, userId, false, []);

      expect(clearState).toHaveBeenCalledWith("autofill-badge-2");
    });

    it("sets state when there are pending tasks for the tab", async () => {
      const tab = { id: 3, url: "https://bitwarden.com" } as chrome.tabs.Tab;
      const pendingTasks: SecurityTask[] = [{ id: "task1", cipherId: "cipher1" } as SecurityTask];
      getAllDecryptedForUrl.mockResolvedValueOnce([{ id: "cipher1" }]);

      await service["setTabState"](tab, userId, true, pendingTasks);

      expect(setState).toHaveBeenCalledWith(
        "autofill-badge-3",
        BadgeStatePriority.High,
        { icon: BadgeIcon.Berry },
        3,
      );
    });

    it("sets state when there are pending tasks for the tab even when badge counter is false", async () => {
      const tab = { id: 4, url: "https://bitwarden.com" } as chrome.tabs.Tab;
      const pendingTasks: SecurityTask[] = [{ id: "task2", cipherId: "cipher2" } as SecurityTask];
      getAllDecryptedForUrl.mockResolvedValueOnce([{ id: "cipher2" }]);

      await service["setTabState"](tab, userId, false, pendingTasks);

      expect(setState).toHaveBeenCalledWith(
        "autofill-badge-4",
        BadgeStatePriority.High,
        { icon: BadgeIcon.Berry },
        4,
      );
    });

    it("sets cipher count", async () => {
      const tab = { id: 5, url: "https://bitwarden.com" } as chrome.tabs.Tab;
      getAllDecryptedForUrl.mockResolvedValueOnce([
        { id: "cipher2" },
        { id: "cipher3" },
        { id: "cipher4" },
      ]);

      await service["setTabState"](tab, userId, true, []);

      expect(setState).toHaveBeenCalledWith(
        "autofill-badge-5",
        BadgeStatePriority.Default,
        { text: "3" },
        5,
      );
    });

    it("sets cipher count to 9+ when there are more than 9 ciphers", async () => {
      const tab = { id: 6, url: "https://bitwarden.com" } as chrome.tabs.Tab;
      getAllDecryptedForUrl.mockResolvedValueOnce(
        new Array(12).fill(null).map((_, i) => ({ id: `cipher-${i + 1}` })),
      );

      await service["setTabState"](tab, userId, true, []);

      expect(setState).toHaveBeenCalledWith(
        "autofill-badge-6",
        BadgeStatePriority.Default,
        { text: "9+" },
        6,
      );
    });
  });
});
