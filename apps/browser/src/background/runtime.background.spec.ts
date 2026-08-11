import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillOrchestrator } from "../autofill/background/autofill-orchestrator";
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

  const tab = createChromeTabMock({ id: 1 });
  const sender = { frameId: 0, tab } as chrome.runtime.MessageSender;
  const extensionUrl = "chrome-extension://abc/";
  // The popup identifies itself as an extension page by its extension-origin url.
  const popupSender = { url: `${extensionUrl}popup/index.html` } as chrome.runtime.MessageSender;

  beforeEach(() => {
    // The ctor wires an onInstalled listener that the shared chrome mock omits.
    (chrome.runtime as any).onInstalled = { addListener: jest.fn() };
    jest.spyOn(BrowserApi, "getRuntimeURL").mockReturnValue(extensionUrl);

    autofillOrchestrator = mock<AutofillOrchestrator>();
    main = mock<MainBackground>();
    accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" } as any);

    runtimeBackground = new RuntimeBackground(
      main,
      mock<AutofillService>(),
      mock<BrowserPlatformUtilsService>(),
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      mock<LogService>(),
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

    it("rejects a request from a content-script sender (not an extension page)", async () => {
      jest.spyOn(BrowserApi, "getTab").mockResolvedValue(tab);
      autofillOrchestrator.collectPageDetails.mockResolvedValue([]);

      // `sender` carries a tab and reports a web-page url, i.e. a content script.
      const result = await runtimeBackground.processMessageWithSender(
        { command: "collectPageDetailsForPopup", tabId: 1 },
        { ...sender, url: "https://evil.example.com" } as chrome.runtime.MessageSender,
      );

      expect(autofillOrchestrator.collectPageDetails).not.toHaveBeenCalled();
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
        { command: "fillCipherForPopup", tabId: 1, cipherId: "cipher-1" },
        popupSender,
      );

      expect(autofillOrchestrator.unsafeAutofillTabWithCipher).toHaveBeenCalledWith(tab, cipher);
      expect(result).toEqual({ didAutofill: true, totp: "totp-123" });
    });

    it("rejects a content-script sender without fetching or filling", async () => {
      const result = await runtimeBackground.processMessageWithSender(
        { command: "fillCipherForPopup", tabId: 1, cipherId: "cipher-1" },
        { ...sender, url: "https://evil.example.com" } as chrome.runtime.MessageSender,
      );

      expect(cipherService.getAllDecrypted).not.toHaveBeenCalled();
      expect(autofillOrchestrator.unsafeAutofillTabWithCipher).not.toHaveBeenCalled();
      expect(result).toEqual({ didAutofill: false });
    });

    it("does not fill when the cipher id is unknown", async () => {
      const result = await runtimeBackground.processMessageWithSender(
        { command: "fillCipherForPopup", tabId: 1, cipherId: "missing" },
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

  describe("collectPageDetailsResponse is not routed to the orchestrator", () => {
    // The orchestrator sends its own collects and consumes the responses internally, so no
    // collectPageDetailsResponse sender is diverted to it.
    it.each(["AutofillCommand", "AutofillCard", "AutofillIdentity", "contextMenu", "autofiller"])(
      "does not divert the %s sender to the orchestrator",
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
