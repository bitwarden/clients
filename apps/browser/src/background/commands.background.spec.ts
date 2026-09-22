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
import { LockService } from "@bitwarden/unlock";

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

describe("CommandsBackground", () => {
  const senderTab = createChromeTabMock({ id: 4, windowId: 2 });

  let main: MockProxy<MainBackground>;
  let authService: MockProxy<AuthService>;
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
    intraprocessMessageSender = new IntraprocessMessageSender();
    externalMessages = new Subject<Message<Record<string, unknown>>>();

    commandsBackground = new CommandsBackground(
      main,
      mock<PlatformUtilsService>(),
      authService,
      () => of("generated-password"),
      mock<AccountService>(),
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
});
