import { mock, MockProxy } from "jest-mock-extended";
import { of, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ExtensionCommand } from "@bitwarden/common/autofill/constants";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  IntraprocessMessageSender,
  Message,
  MessageListener,
} from "@bitwarden/common/platform/messaging";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { LockService } from "@bitwarden/unlock";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { openUnlockPopout } from "../auth/popup/utils/auth-popout-window";
import {
  LockedVaultPendingNotificationsData,
  RETRY_SENDER,
  RETRY_WHEN_UNLOCK_COMPLETED,
} from "../autofill/background/abstractions/notification.background";
import { createChromeTabMock } from "../autofill/spec/autofill-mocks";
import { crossContextBoundary, flushPromises } from "../autofill/spec/testing-utils";
import { BrowserApi } from "../platform/browser/browser-api";

import CommandsBackground from "./commands.background";
import MainBackground from "./main.background";

jest.mock("../auth/popup/utils/auth-popout-window", () => ({ openUnlockPopout: jest.fn() }));

describe("CommandsBackground", () => {
  const senderTab = createChromeTabMock({ id: 4, windowId: 2 });

  let main: MockProxy<MainBackground>;
  let authService: MockProxy<AuthService>;
  let accountService: MockProxy<AccountService>;
  let logService: MockProxy<LogService>;
  // A real channel rather than a mock: what is under test is that the class reads the
  // channel's own messages, which no mocked listener would demonstrate.
  let intraprocessMessageSender: IntraprocessMessageSender;
  let externalMessages: Subject<Message<Record<string, unknown>>>;
  let commandsBackground: CommandsBackground;
  let getTabFromCurrentWindowIdSpy: jest.SpyInstance;

  const retainedRetry = (
    overrides: Partial<LockedVaultPendingNotificationsData> = {},
  ): LockedVaultPendingNotificationsData => ({
    commandToRetry: {
      message: { command: ExtensionCommand.AutofillLogin },
      [RETRY_SENDER]: { tab: senderTab },
    },
    target: "commands.background",
    ...overrides,
  });

  beforeEach(() => {
    (chrome as any).commands = { onCommand: { addListener: jest.fn() } };

    logService = mock<LogService>();
    main = mock<MainBackground>();
    Object.defineProperty(main, "logService", { value: logService, configurable: true });
    authService = mock<AuthService>();
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Unlocked);
    accountService = mock<AccountService>();
    intraprocessMessageSender = new IntraprocessMessageSender();
    externalMessages = new Subject<Message<Record<string, unknown>>>();

    commandsBackground = new CommandsBackground(
      main,
      mock<PlatformUtilsService>(),
      authService,
      () => of("generated-password"),
      accountService,
      mock<LockService>(),
      intraprocessMessageSender,
      // Wired as `MainBackground` wires it, so ingest tagging is exercised rather than faked.
      new MessageListener(intraprocessMessageSender.messages$({ external$: externalMessages })),
    );
    commandsBackground.init();

    // The fallback a sender-less retry would reach. Spied so a test can assert it stays unused.
    getTabFromCurrentWindowIdSpy = jest
      .spyOn(BrowserApi, "getTabFromCurrentWindowId")
      .mockResolvedValue(createChromeTabMock({ id: 99, windowId: 9 }));
  });

  afterEach(() => {
    getTabFromCurrentWindowIdSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe("unlockCompleted", () => {
    it("replays the retained command against the retained tab", async () => {
      intraprocessMessageSender.send(RETRY_WHEN_UNLOCK_COMPLETED, { data: retainedRetry() });
      await flushPromises();

      expect(main.collectPageDetailsForContentScript).toHaveBeenCalledWith(
        senderTab,
        ExtensionCommand.AutofillCommand,
      );
    });

    it("does nothing when another target owns the retry", async () => {
      intraprocessMessageSender.send(RETRY_WHEN_UNLOCK_COMPLETED, {
        data: retainedRetry({ target: "contextmenus.background" }),
      });
      await flushPromises();

      expect(main.collectPageDetailsForContentScript).not.toHaveBeenCalled();
    });

    it("security: drops a retry whose sender did not survive leaving this context", async () => {
      // The target and command both make the trip, so the sender is the only thing missing.
      // Without it `processCommand` would fall back to the active tab, filling a tab the user
      // never asked about.
      const data = crossContextBoundary(retainedRetry());

      intraprocessMessageSender.send(RETRY_WHEN_UNLOCK_COMPLETED, { data });
      await flushPromises();

      expect(getTabFromCurrentWindowIdSpy).not.toHaveBeenCalled();
      expect(main.collectPageDetailsForContentScript).not.toHaveBeenCalled();
    });

    it("security: drops a retry whose sender names no tab", async () => {
      // The fallback is keyed on the tab, not the sender, so a sender without one reaches it.
      const data = retainedRetry();
      data.commandToRetry[RETRY_SENDER] = { frameId: 0 };

      intraprocessMessageSender.send(RETRY_WHEN_UNLOCK_COMPLETED, { data });
      await flushPromises();

      expect(getTabFromCurrentWindowIdSpy).not.toHaveBeenCalled();
      expect(main.collectPageDetailsForContentScript).not.toHaveBeenCalled();
    });

    it("security: ignores a retry that arrived from another context", async () => {
      // The application listener blends chrome runtime messages in and tags them at ingest. The
      // retry names the tab to fill, so only the background may author one.
      externalMessages.next({
        command: RETRY_WHEN_UNLOCK_COMPLETED.command,
        data: retainedRetry(),
      } as unknown as Message<Record<string, unknown>>);
      await flushPromises();

      expect(main.collectPageDetailsForContentScript).not.toHaveBeenCalled();
    });

    it("survives a malformed payload without logging an error or dropping the subscription", async () => {
      intraprocessMessageSender.send(RETRY_WHEN_UNLOCK_COMPLETED, {
        data: { target: "commands.background" } as LockedVaultPendingNotificationsData,
      });
      await flushPromises();

      expect(logService.error).not.toHaveBeenCalled();

      // The subscription must still be live for the next, well-formed retry.
      intraprocessMessageSender.send(RETRY_WHEN_UNLOCK_COMPLETED, { data: retainedRetry() });
      await flushPromises();

      expect(main.collectPageDetailsForContentScript).toHaveBeenCalledWith(
        senderTab,
        ExtensionCommand.AutofillCommand,
      );
    });
  });

  describe("switch account command", () => {
    const [first, second, third] = ["first-user", "second-user", "third-user"] as UserId[];

    const runCommand = async () => {
      const onCommand = (chrome.commands.onCommand.addListener as jest.Mock).mock.calls[0][0];
      await onCommand(ExtensionCommand.SwitchAccount);
    };

    // Accounts in the order they were added, as `accounts$` holds them.
    const givenAccounts = (
      statuses: Partial<Record<UserId, AuthenticationStatus>>,
      activeUserId: UserId | null,
    ) => {
      accountService.accounts$ = of(
        Object.fromEntries(Object.keys(statuses).map((id) => [id, mockAccountInfoWith()])),
      );
      accountService.activeAccount$ = of(
        activeUserId == null ? null : { id: activeUserId, ...mockAccountInfoWith() },
      );
      authService.authStatuses$ = of(statuses);
      authService.getAuthStatus.mockImplementation(async (userId) => statuses[userId as UserId]);
    };

    it("switches to the account after the active one without opening the unlock popout when it is unlocked", async () => {
      givenAccounts(
        {
          [first]: AuthenticationStatus.Unlocked,
          [second]: AuthenticationStatus.Unlocked,
          [third]: AuthenticationStatus.Unlocked,
        },
        first,
      );

      await runCommand();

      expect(main.switchAccount).toHaveBeenCalledWith(second);
      expect(openUnlockPopout).not.toHaveBeenCalled();
    });

    it("wraps from the last account back to the first", async () => {
      givenAccounts(
        {
          [first]: AuthenticationStatus.Unlocked,
          [second]: AuthenticationStatus.Unlocked,
          [third]: AuthenticationStatus.Unlocked,
        },
        third,
      );

      await runCommand();

      expect(main.switchAccount).toHaveBeenCalledWith(first);
    });

    it("skips logged out accounts", async () => {
      givenAccounts(
        {
          [first]: AuthenticationStatus.Unlocked,
          [second]: AuthenticationStatus.LoggedOut,
          [third]: AuthenticationStatus.Unlocked,
        },
        first,
      );

      await runCommand();

      expect(main.switchAccount).toHaveBeenCalledWith(third);
    });

    it("opens the unlock popout over the current tab after switching when the next account is locked", async () => {
      const currentTab = createChromeTabMock({ id: 7, windowId: 3 });
      givenAccounts(
        { [first]: AuthenticationStatus.Unlocked, [second]: AuthenticationStatus.Locked },
        first,
      );
      getTabFromCurrentWindowIdSpy.mockResolvedValue(currentTab);

      await runCommand();

      expect(main.switchAccount).toHaveBeenCalledWith(second);
      expect(openUnlockPopout).toHaveBeenCalledWith(currentTab);
      expect(main.switchAccount.mock.invocationCallOrder[0]).toBeLessThan(
        jest.mocked(openUnlockPopout).mock.invocationCallOrder[0],
      );
    });

    it("still switches but skips the unlock popout when there is no current tab to anchor it", async () => {
      givenAccounts(
        { [first]: AuthenticationStatus.Unlocked, [second]: AuthenticationStatus.Locked },
        first,
      );
      getTabFromCurrentWindowIdSpy.mockResolvedValue(null);

      await runCommand();

      expect(main.switchAccount).toHaveBeenCalledWith(second);
      expect(openUnlockPopout).not.toHaveBeenCalled();
    });

    it("does nothing when the active account is the only one logged in", async () => {
      givenAccounts(
        { [first]: AuthenticationStatus.Unlocked, [second]: AuthenticationStatus.LoggedOut },
        first,
      );

      await runCommand();

      expect(main.switchAccount).not.toHaveBeenCalled();
      expect(openUnlockPopout).not.toHaveBeenCalled();
    });

    it("does nothing when no account is logged in", async () => {
      givenAccounts({ [first]: AuthenticationStatus.LoggedOut }, first);

      await runCommand();

      expect(main.switchAccount).not.toHaveBeenCalled();
    });
  });
});
