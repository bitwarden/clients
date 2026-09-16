import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ExtensionCommand } from "@bitwarden/common/autofill/constants";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  Environment,
  Region,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherType } from "@bitwarden/common/vault/enums";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import {
  openSsoAuthResultPopout,
  openTwoFactorAuthWebAuthnPopout,
} from "../auth/popup/utils/auth-popout-window";
import { AutofillOrchestrator } from "../autofill/background/autofill-orchestrator";
import { AutofillService } from "../autofill/services/abstractions/autofill.service";
import { createChromeTabMock } from "../autofill/spec/autofill-mocks";
import { BrowserEnvironmentService } from "../platform/services/browser-environment.service";
import { BrowserPlatformUtilsService } from "../platform/services/platform-utils/browser-platform-utils.service";

import MainBackground from "./main.background";
import RuntimeBackground from "./runtime.background";

jest.mock("../auth/popup/utils/auth-popout-window");

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
    );
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

describe("RuntimeBackground vault referrer gating", () => {
  const environmentWebVaultUrl = "https://vault.selfhosted.test";
  const regionWebVaultUrl = "https://vault.bitwarden.com";

  let runtimeBackground: RuntimeBackground;
  let environmentService: MockProxy<BrowserEnvironmentService>;

  const buildRuntimeBackground = () =>
    new RuntimeBackground(
      mock<MainBackground>(),
      mock<AutofillService>(),
      mock<BrowserPlatformUtilsService>(),
      undefined as any,
      environmentService,
      mock<MessagingService>(),
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
    );

  beforeEach(() => {
    (chrome.runtime as any).onInstalled = { addListener: jest.fn() };

    environmentService = mock<BrowserEnvironmentService>();
    environmentService.environment$ = new BehaviorSubject({
      getWebVaultUrl: () => environmentWebVaultUrl,
    } as Environment);
    environmentService.availableRegions.mockReturnValue([
      { key: Region.US, domain: "bitwarden.com", urls: { webVault: regionWebVaultUrl } },
    ] as RegionConfig[]);

    runtimeBackground = buildRuntimeBackground();
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
