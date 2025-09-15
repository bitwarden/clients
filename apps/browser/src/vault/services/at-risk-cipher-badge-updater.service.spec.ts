import { BehaviorSubject, firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTask, SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";

import { Tab } from "../../platform/badge/badge-browser-api";
import { BadgeService, DynamicStateFunction } from "../../platform/badge/badge.service";
import { BadgeIcon } from "../../platform/badge/icon";
import { BadgeStatePriority } from "../../platform/badge/priority";
import { Unset } from "../../platform/badge/state";
import { BrowserApi } from "../../platform/browser/browser-api";

import { AtRiskCipherBadgeUpdaterService } from "./at-risk-cipher-badge-updater.service";

describe("AtRiskCipherBadgeUpdaterService", () => {
  let service: AtRiskCipherBadgeUpdaterService;

  let setDynamicState: jest.Mock;
  let getAllDecryptedForUrl: jest.Mock;
  let getTab: jest.Mock;
  let addListener: jest.Mock;

  let activeAccount$: BehaviorSubject<{ id: string }>;
  let cipherViews$: BehaviorSubject<Array<{ id: string; isDeleted?: boolean }>>;
  let pendingTasks$: BehaviorSubject<SecurityTask[]>;

  beforeEach(async () => {
    setDynamicState = jest.fn().mockResolvedValue(undefined);
    getAllDecryptedForUrl = jest.fn().mockResolvedValue([]);
    getTab = jest.fn();
    addListener = jest.fn();

    activeAccount$ = new BehaviorSubject({ id: "test-account-id" });
    cipherViews$ = new BehaviorSubject<Array<{ id: string; isDeleted?: boolean }>>([]);
    pendingTasks$ = new BehaviorSubject<SecurityTask[]>([]);

    jest.spyOn(BrowserApi, "addListener").mockImplementation(addListener);
    jest.spyOn(BrowserApi, "getTab").mockImplementation(getTab);

    service = new AtRiskCipherBadgeUpdaterService(
      { setDynamicState } as unknown as BadgeService,
      { activeAccount$ } as unknown as AccountService,
      { cipherViews$: () => cipherViews$, getAllDecryptedForUrl } as unknown as CipherService,
      { pendingTasks$: () => pendingTasks$ } as unknown as TaskService,
    );

    await service.init();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("registers dynamic state function on init", () => {
    expect(setDynamicState).toHaveBeenCalledWith("at-risk-cipher-badge", expect.any(Function));
  });

  it("clears the tab state when there are no ciphers and no pending tasks", async () => {
    const tab: Tab = { tabId: 1, url: "https://bitwarden.com" };
    const stateFunction = setDynamicState.mock.calls[0][1];

    const state = await firstValueFrom(stateFunction(tab));

    expect(state).toBeUndefined();
  });

  it("sets state when there are pending tasks for the tab", async () => {
    const tab: Tab = { tabId: 3, url: "https://bitwarden.com" };
    const stateFunction: DynamicStateFunction = setDynamicState.mock.calls[0][1];
    const pendingTasks: SecurityTask[] = [
      {
        id: "task1",
        cipherId: "cipher1",
        type: SecurityTaskType.UpdateAtRiskCredential,
      } as SecurityTask,
    ];
    pendingTasks$.next(pendingTasks);
    getAllDecryptedForUrl.mockResolvedValueOnce([{ id: "cipher1" }]);

    const state = await firstValueFrom(stateFunction(tab));

    expect(state).toEqual({
      priority: BadgeStatePriority.High,
      state: {
        icon: BadgeIcon.Berry,
        text: Unset,
        backgroundColor: Unset,
      },
    });
  });
});
