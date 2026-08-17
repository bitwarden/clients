import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ExtensionCommand } from "@bitwarden/common/autofill/constants";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillOrchestrator } from "../autofill/background/abstractions/autofill-orchestrator";
import { AutofillService, PageDetail } from "../autofill/services/abstractions/autofill.service";
import { createChromeTabMock } from "../autofill/spec/autofill-mocks";
import { BrowserApi } from "../platform/browser/browser-api";
import { BrowserPlatformUtilsService } from "../platform/services/platform-utils/browser-platform-utils.service";

import MainBackground from "./main.background";
import RuntimeBackground from "./runtime.background";

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

    runtimeBackground = new RuntimeBackground(
      main,
      mock<AutofillService>(),
      mock<BrowserPlatformUtilsService>(),
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      logService,
      undefined as any,
      undefined as any,
      accountService,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      autofillOrchestrator,
    );
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
        didAutofill: true,
        totp: "totp-123",
      });
    });

    it("fetches the cipher by id and fills it through the orchestrator", async () => {
      const result = await runtimeBackground.processMessageWithSender(
        { command: "fillCipherForPopup", tabId: 1, tabUrl: tab.url, cipherId: "cipher-1" },
        popupSender,
      );

      expect(autofillOrchestrator.unsafeAutofillTabWithCipher).toHaveBeenCalledWith(tab, cipher);
      expect(result).toEqual({ didAutofill: true, totp: "totp-123" });
    });

    it("security: rejects a content-script sender without fetching or filling", async () => {
      // Assert the handler consults `BrowserApi.senderIsInternal`, so that the boundary cannot be silently
      // removed without this failing. The spy calls through to detect regressions inside the guard.
      const senderIsInternalSpy = jest.spyOn(BrowserApi, "senderIsInternal");

      await runtimeBackground.processMessageWithSender(
        { command: "fillCipherForPopup", tabId: 1, cipherId: "cipher-1" },
        contentScriptSender,
      );

      expect(senderIsInternalSpy).toHaveBeenCalledWith(contentScriptSender, logService);
      // Logging the rejection is part of the security requirement: the warning is the
      // observable record that the boundary fired on this sender.
      expect(logService.warning).toHaveBeenCalled();
      expect(cipherService.getAllDecrypted).not.toHaveBeenCalled();
      expect(autofillOrchestrator.unsafeAutofillTabWithCipher).not.toHaveBeenCalled();
    });

    // Functional contract for a rejected sender.
    it("returns a no-fill result when the sender is rejected", async () => {
      jest.spyOn(BrowserApi, "senderIsInternal").mockReturnValue(false);

      const result = await runtimeBackground.processMessageWithSender(
        { command: "fillCipherForPopup", tabId: 1, cipherId: "cipher-1" },
        contentScriptSender,
      );

      expect(result).toEqual({ didAutofill: false });
    });

    it("does not fill when the cipher id is unknown", async () => {
      const result = await runtimeBackground.processMessageWithSender(
        { command: "fillCipherForPopup", tabId: 1, tabUrl: tab.url, cipherId: "missing" },
        popupSender,
      );

      expect(autofillOrchestrator.unsafeAutofillTabWithCipher).not.toHaveBeenCalled();
      expect(result).toEqual({ didAutofill: false });
    });

    it("security: does not fill when the tab navigates after the popup captured its url", async () => {
      // When the freshly fetched tab shows a different URL, the tab navigated during message transmission.
      // This invalidates the message and abandons the fill.
      const result = await runtimeBackground.processMessageWithSender(
        {
          command: "fillCipherForPopup",
          tabId: 1,
          tabUrl: "https://before-nav.example/login",
          cipherId: "cipher-1",
        },
        popupSender,
      );

      expect(autofillOrchestrator.unsafeAutofillTabWithCipher).not.toHaveBeenCalled();
      expect(result).toEqual({ didAutofill: false });
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
    const commandTab = createChromeTabMock({ id: 42 });

    it("routes the AutofillCommand sender to a tab-wide login fill", async () => {
      await runtimeBackground.processMessageWithSender(
        {
          command: "collectPageDetailsResponse",
          sender: ExtensionCommand.AutofillCommand,
          tab: commandTab,
          details: {} as any,
        },
        sender,
      );

      expect(autofillOrchestrator.autofillActiveTabFromCommand).toHaveBeenCalledWith(commandTab);
      expect(autofillOrchestrator.autofillActiveTabForCipherType).not.toHaveBeenCalled();
    });

    it("routes the AutofillCard sender to a card fill", async () => {
      await runtimeBackground.processMessageWithSender(
        {
          command: "collectPageDetailsResponse",
          sender: ExtensionCommand.AutofillCard,
          tab: commandTab,
          details: {} as any,
        },
        sender,
      );

      expect(autofillOrchestrator.autofillActiveTabForCipherType).toHaveBeenCalledWith(
        commandTab,
        CipherType.Card,
      );
      expect(autofillOrchestrator.autofillActiveTabFromCommand).not.toHaveBeenCalled();
    });

    it("routes the AutofillIdentity sender to an identity fill", async () => {
      await runtimeBackground.processMessageWithSender(
        {
          command: "collectPageDetailsResponse",
          sender: ExtensionCommand.AutofillIdentity,
          tab: commandTab,
          details: {} as any,
        },
        sender,
      );

      expect(autofillOrchestrator.autofillActiveTabForCipherType).toHaveBeenCalledWith(
        commandTab,
        CipherType.Identity,
      );
      expect(autofillOrchestrator.autofillActiveTabFromCommand).not.toHaveBeenCalled();
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
