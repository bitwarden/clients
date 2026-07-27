import { mock, MockProxy } from "jest-mock-extended";

import { ExtensionCommand } from "@bitwarden/common/autofill/constants";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherType } from "@bitwarden/common/vault/enums";

import { AutofillOrchestrator } from "../autofill/background/autofill-orchestrator";
import { AutofillService } from "../autofill/services/abstractions/autofill.service";
import { createChromeTabMock } from "../autofill/spec/autofill-mocks";
import { BrowserPlatformUtilsService } from "../platform/services/platform-utils/browser-platform-utils.service";

import MainBackground from "./main.background";
import RuntimeBackground from "./runtime.background";

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

    runtimeBackground = new RuntimeBackground(
      mock<MainBackground>(),
      mock<AutofillService>(),
      mock<BrowserPlatformUtilsService>(),
      undefined as any,
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
      autofillOrchestrator,
    );
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
