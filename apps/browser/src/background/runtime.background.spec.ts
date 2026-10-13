import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { LogoutReason } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ExtensionCommand } from "@bitwarden/common/autofill/constants";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  Environment,
  Region,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { Message, IntraprocessMessageSender } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import {
  openSsoAuthResultPopout,
  openTwoFactorAuthWebAuthnPopout,
} from "../auth/popup/utils/auth-popout-window";
import { AutofillOrchestrator } from "../autofill/background/abstractions/autofill-orchestrator";
import {
  ADD_TO_LOCKED_VAULT_PENDING_NOTIFICATIONS,
  LockedVaultPendingNotificationsData,
  RETRY_SENDER,
  RETRY_WHEN_UNLOCK_COMPLETED,
} from "../autofill/background/abstractions/notification.background";
import { AutofillOutcome } from "../autofill/enums/autofill-outcome.enum";
import { AutofillService, PageDetail } from "../autofill/services/abstractions/autofill.service";
import { createChromeTabMock } from "../autofill/spec/autofill-mocks";
import { crossContextBoundary, tagAsExternalMessage } from "../autofill/spec/testing-utils";
import { BrowserApi } from "../platform/browser/browser-api";
import BrowserPopupUtils from "../platform/browser/browser-popup-utils";
import { BrowserEnvironmentService } from "../platform/services/browser-environment.service";
import { BrowserPlatformUtilsService } from "../platform/services/platform-utils/browser-platform-utils.service";

import MainBackground from "./main.background";
import RuntimeBackground from "./runtime.background";

jest.mock("../auth/popup/utils/auth-popout-window");

type RuntimeBackgroundOverrides = {
  main?: MockProxy<MainBackground>;
  logService?: MockProxy<LogService>;
  /**
   * Left unset rather than mocked, because a bare `mock<AccountService>()` gives
   * `activeAccount$` a jest fn instead of an observable, which fails further from the cause than
   * the missing collaborator does. Supply one in the describes that reach `fillCipherForPopup`.
   */
  accountService?: MockProxy<AccountService>;
  environmentService?: MockProxy<BrowserEnvironmentService>;
  messagingService?: MockProxy<MessagingService>;
  autofillOrchestrator?: MockProxy<AutofillOrchestrator>;
  intraprocessMessageSender?: MockProxy<IntraprocessMessageSender>;
};

function createRuntimeBackground({
  main = mock<MainBackground>(),
  logService = mock<LogService>(),
  accountService = undefined as any,
  environmentService,
  messagingService,
  autofillOrchestrator = mock<AutofillOrchestrator>(),
  intraprocessMessageSender = mock<IntraprocessMessageSender>(),
}: RuntimeBackgroundOverrides = {}) {
  // The `undefined` slots are collaborators no covered path reaches.
  // Give one a mock as soon as a test needs it.
  return new RuntimeBackground(
    main,
    mock<AutofillService>(),
    mock<BrowserPlatformUtilsService>(),
    undefined as any, // autofillSettingsService
    environmentService as any,
    messagingService as any,
    logService,
    undefined as any, // configService
    undefined as any, // messageListener
    accountService,
    undefined as any, // lockService
    undefined as any, // billingAccountProfileStateService
    undefined as any, // browserInitialInstallService
    undefined as any, // autofillLifecycleService
    undefined as any, // defaultPasswordManagerPromptStateAccessor
    autofillOrchestrator,
    intraprocessMessageSender,
  );
}

// The popup round-trips its collect and fill through the background, and
// collectPageDetailsResponse is not routed to the orchestrator (it sends its own collects and
// consumes the responses internally).
describe("RuntimeBackground collection dispatch", () => {
  let runtimeBackground: RuntimeBackground;
  let autofillOrchestrator: MockProxy<AutofillOrchestrator>;
  let main: MockProxy<MainBackground>;
  let accountService: MockProxy<AccountService>;
  let logService: MockProxy<LogService>;

  const tab = createChromeTabMock({ id: 1 });
  const sender = { frameId: 0, tab } as chrome.runtime.MessageSender;
  const extensionUrl = "chrome-extension://abc/";
  // The popup identifies itself as internal by its extension origin (top-level frame, no frameId).
  const popupSender = { origin: "chrome-extension://abc" } as chrome.runtime.MessageSender;
  // A content script: carries a tab and a web-page origin, so the internal-sender guard rejects it on
  // the origin mismatch. Shared by the security tests as the canonical untrusted sender.
  const contentScriptSender = {
    ...sender,
    origin: "https://evil.example.com",
  } as chrome.runtime.MessageSender;

  beforeEach(() => {
    // The ctor wires an onInstalled listener that the shared chrome mock omits.
    (chrome.runtime as any).onInstalled = { addListener: jest.fn() };
    jest.spyOn(BrowserApi, "getRuntimeURL").mockReturnValue(extensionUrl);

    autofillOrchestrator = mock<AutofillOrchestrator>();
    main = mock<MainBackground>();
    accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" } as any);
    logService = mock<LogService>();

    runtimeBackground = createRuntimeBackground({
      main,
      logService,
      accountService,
      autofillOrchestrator,
    });
  });

  afterEach(() => {
    // BrowserApi statics are spied per-test; restore so a spy's call history never leaks into the
    // next test (these tests build identically-shaped senders, which would otherwise alias).
    jest.restoreAllMocks();
  });

  describe("collectPageDetailsForPopup", () => {
    it("collects the requested tab's page details through the orchestrator", async () => {
      const pageDetails: PageDetail[] = [{ frameId: 0, tab, details: {} as any }];
      jest.spyOn(BrowserApi, "getTab").mockResolvedValue(tab);
      autofillOrchestrator.collectPageDetails.mockResolvedValue(pageDetails);

      const result = await runtimeBackground.processMessageWithSender(
        { command: "collectPageDetailsForPopup", tabId: 1 },
        popupSender,
      );

      expect(BrowserApi.getTab).toHaveBeenCalledWith(1);
      expect(autofillOrchestrator.collectPageDetails).toHaveBeenCalledWith(tab);
      expect(result).toBe(pageDetails);
    });

    it("security: rejects a request from a content-script sender (not an extension page)", async () => {
      jest.spyOn(BrowserApi, "getTab").mockResolvedValue(tab);
      autofillOrchestrator.collectPageDetails.mockResolvedValue([]);
      // Assert the handler consults `BrowserApi.senderIsInternal`, so that the boundary cannot be silently
      // removed without this failing. The spy calls through to detect regressions inside the guard.
      const senderIsInternalSpy = jest.spyOn(BrowserApi, "senderIsInternal");

      await runtimeBackground.processMessageWithSender(
        { command: "collectPageDetailsForPopup", tabId: 1 },
        contentScriptSender,
      );

      expect(senderIsInternalSpy).toHaveBeenCalledWith(contentScriptSender, logService);
      // Logging the rejection is part of the security requirement, not incidental: the warning is the
      // observable record that the boundary fired on this sender.
      expect(logService.warning).toHaveBeenCalled();
      expect(autofillOrchestrator.collectPageDetails).not.toHaveBeenCalled();
    });

    // Functional contract for a rejected sender, kept separate from the security invariant above: the
    // return shape may change without weakening the boundary. Rejection is forced here so the shape is
    // pinned independently of how a sender is judged internal.
    it("returns an empty array when the sender is rejected", async () => {
      jest.spyOn(BrowserApi, "senderIsInternal").mockReturnValue(false);

      const result = await runtimeBackground.processMessageWithSender(
        { command: "collectPageDetailsForPopup", tabId: 1 },
        contentScriptSender,
      );

      expect(result).toEqual([]);
    });

    it("returns an empty array without collecting when the tab is gone", async () => {
      jest.spyOn(BrowserApi, "getTab").mockResolvedValue(null);

      const result = await runtimeBackground.processMessageWithSender(
        { command: "collectPageDetailsForPopup", tabId: 99 },
        popupSender,
      );

      expect(autofillOrchestrator.collectPageDetails).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("fillCipherForPopup", () => {
    const cipher = Object.assign(new CipherView(), { id: "cipher-1" });
    let cipherService: MockProxy<CipherService>;

    beforeEach(() => {
      jest.spyOn(BrowserApi, "getTab").mockResolvedValue(tab);
      cipherService = mock<CipherService>();
      cipherService.getAllDecrypted.mockResolvedValue([cipher]);
      (main as any).cipherService = cipherService;
      autofillOrchestrator.unsafeAutofillTabWithCipher.mockResolvedValue({
        outcome: AutofillOutcome.Filled,
        totp: "totp-123",
      });
    });

    it("fetches the cipher by id and fills it through the orchestrator", async () => {
      const result = await runtimeBackground.processMessageWithSender(
        { command: "fillCipherForPopup", tabId: 1, tabUrl: tab.url, cipherId: "cipher-1" },
        popupSender,
      );

      expect(autofillOrchestrator.unsafeAutofillTabWithCipher).toHaveBeenCalledWith(tab, cipher);
      expect(result).toEqual({ outcome: AutofillOutcome.Filled, totp: "totp-123" });
    });

    it("security: rejects a content-script sender without fetching or filling", async () => {
      // Assert the handler consults `BrowserApi.senderIsInternal`, so that the boundary cannot be silently
      // removed without this failing. The spy calls through to detect regressions inside the guard.
      const senderIsInternalSpy = jest.spyOn(BrowserApi, "senderIsInternal");

      await runtimeBackground.processMessageWithSender(
        { command: "fillCipherForPopup", tabId: 1, tabUrl: tab.url, cipherId: "cipher-1" },
        contentScriptSender,
      );

      expect(senderIsInternalSpy).toHaveBeenCalledWith(contentScriptSender, logService);
      // Logging the rejection is part of the security requirement: the warning is the
      // observable record that the boundary fired on this sender.
      expect(logService.warning).toHaveBeenCalled();
      expect(cipherService.getAllDecrypted).not.toHaveBeenCalled();
      expect(autofillOrchestrator.unsafeAutofillTabWithCipher).not.toHaveBeenCalled();
    });

    // Safeguard `unsafeAutofillTabWithCipher` from being used as an oracle. Every early
    // exit reports the same outcome, so a caller cannot use the reply to learn which check turned
    // it away.
    describe("security: emit a denied outcome when processing early exits", () => {
      const fillMessage = { command: "fillCipherForPopup", tabId: 1, cipherId: "cipher-1" };

      it("denies a rejected sender", async () => {
        jest.spyOn(BrowserApi, "senderIsInternal").mockReturnValue(false);

        const result = await runtimeBackground.processMessageWithSender(
          { ...fillMessage, tabUrl: tab.url },
          contentScriptSender,
        );

        expect(autofillOrchestrator.unsafeAutofillTabWithCipher).not.toHaveBeenCalled();
        expect(result).toEqual({ outcome: AutofillOutcome.Denied });
      });

      it("denies a tab that is gone", async () => {
        jest.spyOn(BrowserApi, "getTab").mockResolvedValue(null);

        const result = await runtimeBackground.processMessageWithSender(
          { ...fillMessage, tabUrl: tab.url },
          popupSender,
        );

        expect(autofillOrchestrator.unsafeAutofillTabWithCipher).not.toHaveBeenCalled();
        expect(result).toEqual({ outcome: AutofillOutcome.Denied });
      });

      it("denies a tab that navigated after the popup captured its url", async () => {
        const result = await runtimeBackground.processMessageWithSender(
          { ...fillMessage, tabUrl: "https://before-nav.example/login" },
          popupSender,
        );

        expect(autofillOrchestrator.unsafeAutofillTabWithCipher).not.toHaveBeenCalled();
        expect(result).toEqual({ outcome: AutofillOutcome.Denied });
      });

      it("denies a request with no active user", async () => {
        accountService.activeAccount$ = of(null as any);

        const result = await runtimeBackground.processMessageWithSender(
          { ...fillMessage, tabUrl: tab.url },
          popupSender,
        );

        expect(autofillOrchestrator.unsafeAutofillTabWithCipher).not.toHaveBeenCalled();
        expect(result).toEqual({ outcome: AutofillOutcome.Denied });
      });

      it("denies an unknown cipher", async () => {
        const result = await runtimeBackground.processMessageWithSender(
          { ...fillMessage, tabUrl: tab.url, cipherId: "missing" },
          popupSender,
        );

        expect(autofillOrchestrator.unsafeAutofillTabWithCipher).not.toHaveBeenCalled();
        expect(result).toEqual({ outcome: AutofillOutcome.Denied });
      });
    });
  });

  describe("bgCollectPageDetails", () => {
    it("routes the content-initiated refresh through the orchestrator", async () => {
      autofillOrchestrator.collectPageDetails.mockResolvedValue([]);

      await runtimeBackground.processMessageWithSender(
        { command: "bgCollectPageDetails", sender: "autofillInit" },
        sender,
      );

      expect(autofillOrchestrator.collectPageDetails).toHaveBeenCalledWith(tab, sender.frameId);
    });
  });

  // Test-only affordance: a command-issued collect, echoed back by the
  // content script tagged with the command's sender, is diverted to the orchestrator so that autofill
  // can be exercised independently of any input method.
  describe("collectPageDetailsResponse command routing", () => {
    // A tab the message body names but the sender is not. Present in every case below so the
    // assertions fail if the body is ever read back as the fill target.
    const bodyTab = createChromeTabMock({ id: 42 });

    it("routes the AutofillCommand sender to a tab-wide login fill", async () => {
      await runtimeBackground.processMessageWithSender(
        {
          command: "collectPageDetailsResponse",
          sender: ExtensionCommand.AutofillCommand,
          tab: bodyTab,
          details: {} as any,
        },
        sender,
      );

      expect(autofillOrchestrator.autofillActiveTabFromCommand).toHaveBeenCalledWith(tab);
      expect(autofillOrchestrator.autofillActiveTabForCipherType).not.toHaveBeenCalled();
    });

    it("routes the AutofillCard sender to a card fill", async () => {
      await runtimeBackground.processMessageWithSender(
        {
          command: "collectPageDetailsResponse",
          sender: ExtensionCommand.AutofillCard,
          tab: bodyTab,
          details: {} as any,
        },
        sender,
      );

      expect(autofillOrchestrator.autofillActiveTabForCipherType).toHaveBeenCalledWith(
        tab,
        CipherType.Card,
      );
      expect(autofillOrchestrator.autofillActiveTabFromCommand).not.toHaveBeenCalled();
    });

    it("routes the AutofillIdentity sender to an identity fill", async () => {
      await runtimeBackground.processMessageWithSender(
        {
          command: "collectPageDetailsResponse",
          sender: ExtensionCommand.AutofillIdentity,
          tab: bodyTab,
          details: {} as any,
        },
        sender,
      );

      expect(autofillOrchestrator.autofillActiveTabForCipherType).toHaveBeenCalledWith(
        tab,
        CipherType.Identity,
      );
      expect(autofillOrchestrator.autofillActiveTabFromCommand).not.toHaveBeenCalled();
    });

    // The fill target is the tab the browser attests the message came from. A sender with no tab
    // names no target, and the body must not be allowed to supply one in its place.
    it("security: routes nothing when the sender carries no tab", async () => {
      await runtimeBackground.processMessageWithSender(
        {
          command: "collectPageDetailsResponse",
          sender: ExtensionCommand.AutofillCommand,
          tab: bodyTab,
          details: {} as any,
        },
        { frameId: 0 } as chrome.runtime.MessageSender,
      );

      expect(autofillOrchestrator.autofillActiveTabFromCommand).not.toHaveBeenCalled();
      expect(autofillOrchestrator.autofillActiveTabForCipherType).not.toHaveBeenCalled();
    });

    // The orchestrator sends its own collects (`collectPageDetailsFromTabObservable`) and consumes
    // those responses internally; other senders carry no command intent and must not trigger a fill.
    it.each(["contextMenuHandler", "autofiller", "collectPageDetailsFromTabObservable", undefined])(
      "does not route the %s sender to the orchestrator",
      async (msgSender) => {
        await runtimeBackground.processMessageWithSender(
          { command: "collectPageDetailsResponse", sender: msgSender, tab, details: {} as any },
          sender,
        );

        expect(autofillOrchestrator.autofillActiveTabFromCommand).not.toHaveBeenCalled();
        expect(autofillOrchestrator.autofillActiveTabForCipherType).not.toHaveBeenCalled();
      },
    );
  });
});

describe("RuntimeBackground getUrlAutofillTargetingRules", () => {
  const committedUrl = "https://example.test/entry";
  const routedUrl = "https://example.test/logged-in/step-one";

  let runtimeBackground: RuntimeBackground;
  let mainBackground: MockProxy<MainBackground>;
  let domainSettingsService: MockProxy<DomainSettingsService>;

  const message = { command: "getUrlAutofillTargetingRules" };

  /** Stands in for the frame lookup `BrowserApi.getFrameDetails` performs. */
  const mockFrameLookup = (url: string | undefined) => {
    (chrome.webNavigation.getFrame as unknown as jest.Mock).mockImplementation(
      (_details, callback) => callback(url == null ? undefined : { url }),
    );
  };

  beforeEach(() => {
    (chrome.runtime as any).onInstalled = { addListener: jest.fn() };

    domainSettingsService = mock<DomainSettingsService>();
    mainBackground = mock<MainBackground>();
    (mainBackground as any).domainSettingsService = domainSettingsService;

    runtimeBackground = createRuntimeBackground({ main: mainBackground });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("matches rules against the frame's live URL rather than the URL it was committed at", async () => {
    mockFrameLookup(routedUrl);
    const sender = {
      frameId: 0,
      // `sender.url` reports the last cross-document navigation, so a same-document route
      // change leaves it pinned to the entry URL.
      url: committedUrl,
      tab: createChromeTabMock({ id: 1, url: routedUrl }),
    } as chrome.runtime.MessageSender;

    await runtimeBackground.processMessageWithSender(message, sender);

    expect(domainSettingsService.getTargetingRulesForUrl).toHaveBeenCalledWith(routedUrl);
  });

  it("matches a sub-frame against its own URL, not the tab's", async () => {
    const subFrameUrl = "https://widget.example.test/form";
    mockFrameLookup(subFrameUrl);
    const sender = {
      frameId: 7,
      url: subFrameUrl,
      tab: createChromeTabMock({ id: 1, url: routedUrl }),
    } as chrome.runtime.MessageSender;

    await runtimeBackground.processMessageWithSender(message, sender);

    expect(domainSettingsService.getTargetingRulesForUrl).toHaveBeenCalledWith(subFrameUrl);
  });

  it("falls back to the tab URL for a top-level frame when the frame lookup resolves nothing", async () => {
    mockFrameLookup(undefined);
    const sender = {
      frameId: 0,
      url: committedUrl,
      tab: createChromeTabMock({ id: 1, url: routedUrl }),
    } as chrome.runtime.MessageSender;

    await runtimeBackground.processMessageWithSender(message, sender);

    expect(domainSettingsService.getTargetingRulesForUrl).toHaveBeenCalledWith(routedUrl);
  });

  it("falls back to the sender URL for a sub-frame when the frame lookup resolves nothing", async () => {
    const subFrameUrl = "https://widget.example.test/form";
    mockFrameLookup(undefined);
    const sender = {
      frameId: 7,
      url: subFrameUrl,
      tab: createChromeTabMock({ id: 1, url: routedUrl }),
    } as chrome.runtime.MessageSender;

    await runtimeBackground.processMessageWithSender(message, sender);

    expect(domainSettingsService.getTargetingRulesForUrl).toHaveBeenCalledWith(subFrameUrl);
  });

  it("falls back to the sender URL when there is no tab to look a frame up in", async () => {
    const sender = { frameId: undefined, url: committedUrl } as chrome.runtime.MessageSender;

    await runtimeBackground.processMessageWithSender(message, sender);

    expect(chrome.webNavigation.getFrame).not.toHaveBeenCalled();
    expect(domainSettingsService.getTargetingRulesForUrl).toHaveBeenCalledWith(committedUrl);
  });

  it("returns the resolved rules to the caller", async () => {
    const rules = [{ category: "account-login", fields: {} }] as any;
    mockFrameLookup(routedUrl);
    domainSettingsService.getTargetingRulesForUrl.mockResolvedValue(rules);
    const sender = {
      frameId: 0,
      url: committedUrl,
      tab: createChromeTabMock({ id: 1, url: routedUrl }),
    } as chrome.runtime.MessageSender;

    const result = await runtimeBackground.processMessageWithSender(message, sender);

    expect(result).toBe(rules);
  });
});

// The logout dispatch reads `msg.logoutReason` off the incoming message and
// forwards it to `MainBackground.logout`. It previously read `msg.expired`, a
// stale field no producer sets, so the reason was silently dropped and the
// popup lost its post-logout toast. This guards against that field-name drift.
describe("RuntimeBackground logout dispatch", () => {
  let runtimeBackground: RuntimeBackground;
  let mainBackground: MockProxy<MainBackground>;

  const userId = "user-1" as UserId;
  const logoutReason: LogoutReason = "userInitiated";

  beforeEach(() => {
    (chrome.runtime as any).onInstalled = { addListener: jest.fn() };

    mainBackground = mock<MainBackground>();

    runtimeBackground = new RuntimeBackground(
      mainBackground,
      mock<AutofillService>(),
      mock<BrowserPlatformUtilsService>(),
      undefined as any,
      undefined as any,
      undefined as any,
      mock<LogService>(),
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      mock<AutofillOrchestrator>(),
      mock<IntraprocessMessageSender>(),
    );
  });

  it("forwards logoutReason and userId from the message to MainBackground.logout", async () => {
    await runtimeBackground.processMessage({ command: "logout", logoutReason, userId });

    expect(mainBackground.logout).toHaveBeenCalledWith(logoutReason, userId);
  });

  it("forwards undefined userId when the message does not include one", async () => {
    await runtimeBackground.processMessage({ command: "logout", logoutReason });

    expect(mainBackground.logout).toHaveBeenCalledWith(logoutReason, undefined);
  });
});

describe("RuntimeBackground vault referrer gating", () => {
  const environmentWebVaultUrl = "https://vault.selfhosted.test";
  const regionWebVaultUrl = "https://vault.bitwarden.com";

  let runtimeBackground: RuntimeBackground;
  let environmentService: MockProxy<BrowserEnvironmentService>;

  beforeEach(() => {
    (chrome.runtime as any).onInstalled = { addListener: jest.fn() };

    environmentService = mock<BrowserEnvironmentService>();
    environmentService.environment$ = new BehaviorSubject({
      getWebVaultUrl: () => environmentWebVaultUrl,
    } as Environment);
    environmentService.availableRegions.mockReturnValue([
      { key: Region.US, domain: "bitwarden.com", urls: { webVault: regionWebVaultUrl } },
    ] as RegionConfig[]);

    runtimeBackground = createRuntimeBackground({
      environmentService,
      messagingService: mock<MessagingService>(),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("authResult", () => {
    const message = (referrer: string) => ({
      command: "authResult",
      code: "code",
      state: "state",
      referrer,
    });

    it("opens the SSO popout when the referrer is the configured web vault", async () => {
      await runtimeBackground.processMessageWithSender(
        message("vault.selfhosted.test"),
        {} as chrome.runtime.MessageSender,
      );

      expect(openSsoAuthResultPopout).toHaveBeenCalled();
    });

    it("opens the SSO popout when the referrer is a known region's web vault", async () => {
      await runtimeBackground.processMessageWithSender(
        message("vault.bitwarden.com"),
        {} as chrome.runtime.MessageSender,
      );

      expect(openSsoAuthResultPopout).toHaveBeenCalled();
    });

    it("ignores a referrer that is not a known vault", async () => {
      await runtimeBackground.processMessageWithSender(
        message("attacker.test"),
        {} as chrome.runtime.MessageSender,
      );

      expect(openSsoAuthResultPopout).not.toHaveBeenCalled();
    });

    it("ignores a message with no referrer", async () => {
      await runtimeBackground.processMessageWithSender(
        { command: "authResult", code: "code", state: "state" },
        {} as chrome.runtime.MessageSender,
      );

      expect(openSsoAuthResultPopout).not.toHaveBeenCalled();
    });
  });

  describe("webAuthnResult", () => {
    const message = (referrer: string) => ({
      command: "webAuthnResult",
      data: "data",
      remember: true,
      referrer,
    });

    it("opens the WebAuthn popout when the referrer is the configured web vault", async () => {
      await runtimeBackground.processMessage(message("vault.selfhosted.test"));

      expect(openTwoFactorAuthWebAuthnPopout).toHaveBeenCalled();
    });

    it("opens the WebAuthn popout when the referrer is a known region's web vault", async () => {
      await runtimeBackground.processMessage(message("vault.bitwarden.com"));

      expect(openTwoFactorAuthWebAuthnPopout).toHaveBeenCalled();
    });

    it("ignores a referrer that is not a known vault", async () => {
      await runtimeBackground.processMessage(message("attacker.test"));

      expect(openTwoFactorAuthWebAuthnPopout).not.toHaveBeenCalled();
    });

    it("ignores a message with no referrer", async () => {
      await runtimeBackground.processMessage({
        command: "webAuthnResult",
        data: "data",
        remember: true,
      });

      expect(openTwoFactorAuthWebAuthnPopout).not.toHaveBeenCalled();
    });
  });
});

describe("RuntimeBackground locked vault pending notifications", () => {
  let runtimeBackground: RuntimeBackground;
  let intraprocessMessageSender: MockProxy<IntraprocessMessageSender>;
  let tabSendMessageDataSpy: jest.SpyInstance;
  let focusWindowSpy: jest.SpyInstance;
  let focusTabSpy: jest.SpyInstance;

  const retainedRetry = (): LockedVaultPendingNotificationsData => ({
    commandToRetry: {
      message: { command: ExtensionCommand.AutofillLogin },
      [RETRY_SENDER]: { tab: createChromeTabMock({ id: 7, windowId: 3 }) },
    },
    target: "commands.background",
  });

  const enqueue = (message: Message<Record<string, unknown>>) =>
    runtimeBackground.processMessage(message);

  beforeEach(() => {
    // The ctor wires an onInstalled listener that the shared chrome mock omits.
    (chrome.runtime as any).onInstalled = { addListener: jest.fn() };
    jest.spyOn(BrowserPopupUtils, "closeSingleActionPopout").mockImplementation();
    focusWindowSpy = jest.spyOn(BrowserApi, "focusWindow").mockImplementation();
    focusTabSpy = jest.spyOn(BrowserApi, "focusTab").mockImplementation();
    jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([]);
    tabSendMessageDataSpy = jest.spyOn(BrowserApi, "tabSendMessageData").mockImplementation();

    intraprocessMessageSender = mock<IntraprocessMessageSender>();
    runtimeBackground = createRuntimeBackground({ intraprocessMessageSender });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Asserted through the dispatch rather than the private queue: a retry only matters if it is
  // actually replayed, and `unlocked` is the only thing that drains it.
  it("replays a retry that was published inside the background", async () => {
    const data = retainedRetry();
    await enqueue({ command: ADD_TO_LOCKED_VAULT_PENDING_NOTIFICATIONS.command, data });

    await enqueue({ command: "unlocked" });

    expect(intraprocessMessageSender.send).toHaveBeenCalledWith(RETRY_WHEN_UNLOCK_COMPLETED, {
      data,
    });
  });

  it("security: never republishes the retry to the sender tab", async () => {
    await enqueue({
      command: ADD_TO_LOCKED_VAULT_PENDING_NOTIFICATIONS.command,
      data: retainedRetry(),
    });

    await enqueue({ command: "unlocked" });

    expect(tabSendMessageDataSpy).not.toHaveBeenCalledWith(
      expect.anything(),
      RETRY_WHEN_UNLOCK_COMPLETED.command,
      expect.anything(),
    );
  });

  it("security: drops a retry that arrived from outside the background", async () => {
    // `commandToRetry` names the tab that receives the retried autofill and the click data that
    // selects the cipher, so a sender able to reach `chrome.runtime.onMessage` must not be able
    // to enqueue one.
    await enqueue(
      tagAsExternalMessage({
        command: ADD_TO_LOCKED_VAULT_PENDING_NOTIFICATIONS.command,
        data: retainedRetry(),
      }),
    );

    await enqueue({ command: "unlocked" });

    expect(intraprocessMessageSender.send).not.toHaveBeenCalledWith(
      RETRY_WHEN_UNLOCK_COMPLETED,
      expect.anything(),
    );
  });

  it("security: focuses no tab for a retry whose sender did not survive leaving this context", async () => {
    const data = crossContextBoundary(retainedRetry());

    await enqueue({ command: ADD_TO_LOCKED_VAULT_PENDING_NOTIFICATIONS.command, data });

    await enqueue({ command: "unlocked" });

    expect(focusWindowSpy).not.toHaveBeenCalled();
    expect(focusTabSpy).not.toHaveBeenCalled();
  });

  it("publishes a retry whose sender did not survive leaving this context", async () => {
    // Failing closed is local, not global: `OverlayBackground` refreshes auth status and ciphers
    // on the retry regardless, so the publish has to survive the missing sender.
    const data = crossContextBoundary(retainedRetry());

    await enqueue({ command: ADD_TO_LOCKED_VAULT_PENDING_NOTIFICATIONS.command, data });

    await enqueue({ command: "unlocked" });

    expect(intraprocessMessageSender.send).toHaveBeenCalledWith(RETRY_WHEN_UNLOCK_COMPLETED, {
      data,
    });
  });

  it("dispatches no retry when none was queued", async () => {
    await enqueue({ command: "unlocked" });

    expect(intraprocessMessageSender.send).not.toHaveBeenCalledWith(
      RETRY_WHEN_UNLOCK_COMPLETED,
      expect.anything(),
    );
  });
});
