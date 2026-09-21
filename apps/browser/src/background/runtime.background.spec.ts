import { mock, MockProxy } from "jest-mock-extended";

import { ExtensionCommand } from "@bitwarden/common/autofill/constants";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Message, IntraprocessMessageSender } from "@bitwarden/common/platform/messaging";
import { CipherType } from "@bitwarden/common/vault/enums";

import {
  ADD_TO_LOCKED_VAULT_PENDING_NOTIFICATIONS,
  LockedVaultPendingNotificationsData,
  RETRY_SENDER,
  RETRY_WHEN_UNLOCK_COMPLETED,
} from "../autofill/background/abstractions/notification.background";
import { AutofillOrchestrator } from "../autofill/background/autofill-orchestrator";
import { AutofillService } from "../autofill/services/abstractions/autofill.service";
import { createChromeTabMock } from "../autofill/spec/autofill-mocks";
import { crossContextBoundary, tagAsExternalMessage } from "../autofill/spec/testing-utils";
import { BrowserApi } from "../platform/browser/browser-api";
import BrowserPopupUtils from "../platform/browser/browser-popup-utils";
import { BrowserPlatformUtilsService } from "../platform/services/platform-utils/browser-platform-utils.service";

import MainBackground from "./main.background";
import RuntimeBackground from "./runtime.background";

type RuntimeBackgroundOverrides = {
  main?: MockProxy<MainBackground>;
  autofillOrchestrator?: MockProxy<AutofillOrchestrator>;
  intraprocessMessageSender?: MockProxy<IntraprocessMessageSender>;
};

function createRuntimeBackground({
  main = mock<MainBackground>(),
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
    undefined as any, // environmentService
    undefined as any, // messagingService
    mock<LogService>(),
    undefined as any, // configService
    undefined as any, // messageListener
    undefined as any, // accountService
    undefined as any, // lockService
    undefined as any, // billingAccountProfileStateService
    undefined as any, // browserInitialInstallService
    undefined as any, // autofillLifecycleService
    undefined as any, // defaultPasswordManagerPromptStateAccessor
    autofillOrchestrator,
    intraprocessMessageSender,
  );
}

// The `collectPageDetailsResponse` handler is the seam Step 5 rewired: the
// page-load ("autofiller") sender no longer routes here, and the user-initiated
// senders now forward to `AutofillOrchestrator`. These regressions guard against the
// shared switch block being deleted wholesale (RISKS §1.3 / IMPACT F13).
describe("RuntimeBackground collectPageDetailsResponse routing", () => {
  let runtimeBackground: RuntimeBackground;
  let autofillOrchestrator: MockProxy<AutofillOrchestrator>;

  const tab = createChromeTabMock({ id: 1 });
  const details = { foo: "bar" } as any;
  const sender = { frameId: 0, tab } as chrome.runtime.MessageSender;
  const message = (msgSender: string) => ({
    command: "collectPageDetailsResponse",
    sender: msgSender,
    tab,
    details,
  });
  const expectedPageDetail = { frameId: 0, tab, details };

  beforeEach(() => {
    // The ctor wires an onInstalled listener that the shared chrome mock omits.
    (chrome.runtime as any).onInstalled = { addListener: jest.fn() };

    autofillOrchestrator = mock<AutofillOrchestrator>();
    runtimeBackground = createRuntimeBackground({ autofillOrchestrator });
  });

  it("forwards a keyboard-shortcut collection to AutofillOrchestrator", async () => {
    await runtimeBackground.processMessageWithSender(
      message(ExtensionCommand.AutofillCommand),
      sender,
    );

    expect(autofillOrchestrator.autofillActiveTabFromCommand).toHaveBeenCalledWith(
      expectedPageDetail,
    );
  });

  it("forwards a card collection to AutofillOrchestrator with the card cipher type", async () => {
    await runtimeBackground.processMessageWithSender(
      message(ExtensionCommand.AutofillCard),
      sender,
    );

    expect(autofillOrchestrator.autofillActiveTabForCipherType).toHaveBeenCalledWith(
      expectedPageDetail,
      CipherType.Card,
    );
  });

  it("forwards an identity collection to AutofillOrchestrator with the identity cipher type", async () => {
    await runtimeBackground.processMessageWithSender(
      message(ExtensionCommand.AutofillIdentity),
      sender,
    );

    expect(autofillOrchestrator.autofillActiveTabForCipherType).toHaveBeenCalledWith(
      expectedPageDetail,
      CipherType.Identity,
    );
  });

  it("keeps the context-menu sender on its own path, not AutofillOrchestrator", async () => {
    jest.useFakeTimers();

    await runtimeBackground.processMessageWithSender(message("contextMenu"), sender);

    // Positive assertion that the case body still runs (guards against the whole
    // shared block being deleted): the context-menu path accumulates page details.
    expect((runtimeBackground as any).pageDetailsToAutoFill).toHaveLength(1);
    // ...and does not divert to the AutofillOrchestrator seam.
    expect(autofillOrchestrator.autofillActiveTabFromCommand).not.toHaveBeenCalled();
    expect(autofillOrchestrator.autofillActiveTabForCipherType).not.toHaveBeenCalled();

    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("no longer routes the retired autofiller sender through AutofillOrchestrator", async () => {
    await runtimeBackground.processMessageWithSender(message("autofiller"), sender);

    expect(autofillOrchestrator.autofillActiveTabFromCommand).not.toHaveBeenCalled();
    expect(autofillOrchestrator.autofillActiveTabForCipherType).not.toHaveBeenCalled();
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
