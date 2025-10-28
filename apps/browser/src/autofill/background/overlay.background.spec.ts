import { mock, MockProxy, mockReset } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import {
  AutofillOverlayVisibility,
  SHOW_AUTOFILL_BUTTON,
} from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction as AutofillSettingsService } from "@bitwarden/common/autofill/services/autofill-settings.service";
import {
  DefaultDomainSettingsService,
  DomainSettingsService,
} from "@bitwarden/common/autofill/services/domain-settings.service";
import { InlineMenuVisibilitySetting } from "@bitwarden/common/autofill/types";
import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  EnvironmentService,
  Region,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CloudEnvironment } from "@bitwarden/common/platform/services/default-environment.service";
import { Fido2ActiveRequestManager } from "@bitwarden/common/platform/services/fido2/fido2-active-request-manager";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";

import { BrowserApi } from "../../platform/browser/browser-api";
import { BrowserPlatformUtilsService } from "../../platform/services/platform-utils/browser-platform-utils.service";
import {
  AutofillOverlayElement,
  AutofillOverlayPort,
  InlineMenuAccountCreationFieldType,
  InlineMenuFillTypes,
  MAX_SUB_FRAME_DEPTH,
  RedirectFocusDirection,
} from "../enums/autofill-overlay.enum";
import { AutofillService } from "../services/abstractions/autofill.service";
import { InlineMenuFieldQualificationService } from "../services/inline-menu-field-qualification.service";
import {
  createAutofillFieldMock,
  createAutofillPageDetailsMock,
  createChromeTabMock,
  createFocusedFieldDataMock,
  createPageDetailMock,
  createPortSpyMock,
} from "../spec/autofill-mocks";
import {
  flushPromises,
  sendMockExtensionMessage,
  sendPortMessage,
  triggerPortOnConnectEvent,
  triggerPortOnDisconnectEvent,
  triggerPortOnMessageEvent,
  triggerWebNavigationOnCommittedEvent,
  triggerWebRequestOnCompletedEvent,
} from "../spec/testing-utils";

import { ModifyLoginCipherFormData } from "./abstractions/overlay-notifications.background";
import {
  FocusedFieldData,
  InlineMenuPosition,
  PageDetailsForTab,
  SubFrameOffsetData,
  SubFrameOffsetsForTab,
} from "./abstractions/overlay.background";
import { OverlayBackground } from "./overlay.background";

describe("OverlayBackground", () => {
  const generatedPassword = "generated-password";
  const generatedPasswordCallbackMock = jest.fn().mockResolvedValue(generatedPassword);
  const addPasswordCallbackMock = jest.fn();
  const mockUserId = Utils.newGuid() as UserId;
  const sendResponse = jest.fn();
  let accountService: FakeAccountService;
  let fakeStateProvider: FakeStateProvider;
  let showFaviconsMock$: BehaviorSubject<boolean>;
  let neverDomainsMock$: BehaviorSubject<NeverDomains>;
  let domainSettingsService: DomainSettingsService;
  let logService: MockProxy<LogService>;
  let cipherService: MockProxy<CipherService>;
  let autofillService: MockProxy<AutofillService>;
  let configService: MockProxy<ConfigService>;
  let activeAccountStatusMock$: BehaviorSubject<AuthenticationStatus>;
  let authService: MockProxy<AuthService>;
  let environmentMock$: BehaviorSubject<CloudEnvironment>;
  let environmentService: MockProxy<EnvironmentService>;
  let inlineMenuVisibilityMock$: BehaviorSubject<InlineMenuVisibilitySetting>;
  let autofillSettingsService: MockProxy<AutofillSettingsService>;
  let i18nService: MockProxy<I18nService>;
  let platformUtilsService: MockProxy<BrowserPlatformUtilsService>;
  let enablePasskeysMock$: BehaviorSubject<boolean>;
  let vaultSettingsServiceMock: MockProxy<VaultSettingsService>;
  const policyService = mock<PolicyService>();
  let fido2ActiveRequestManager: Fido2ActiveRequestManager;
  let selectedThemeMock$: BehaviorSubject<ThemeType>;
  let inlineMenuFieldQualificationService: InlineMenuFieldQualificationService;
  let themeStateService: MockProxy<ThemeStateService>;
  let totpService: MockProxy<TotpService>;
  let overlayBackground: OverlayBackground;
  let portKeyForTabSpy: Record<number, string>;
  let pageDetailsForTabSpy: PageDetailsForTab;
  let subFrameOffsetsSpy: SubFrameOffsetsForTab;
  let getFrameDetailsSpy: jest.SpyInstance;
  let tabsSendMessageSpy: jest.SpyInstance;
  let tabSendMessageDataSpy: jest.SpyInstance;
  let getTabFromCurrentWindowIdSpy: jest.SpyInstance;
  let getTabSpy: jest.SpyInstance;
  let openUnlockPopoutSpy: jest.SpyInstance;
  let buttonPortSpy: chrome.runtime.Port;
  let buttonMessageConnectorSpy: chrome.runtime.Port;
  let listPortSpy: chrome.runtime.Port;
  let listMessageConnectorSpy: chrome.runtime.Port;

  let getFrameCounter: number = 2;
  async function initOverlayElementPorts(options = { initList: true, initButton: true }) {
    const { initList, initButton } = options;
    if (initButton) {
      triggerPortOnConnectEvent(createPortSpyMock(AutofillOverlayPort.Button));
      await flushPromises();
      buttonPortSpy = overlayBackground["inlineMenuButtonPort"];

      buttonMessageConnectorSpy = createPortSpyMock(AutofillOverlayPort.ButtonMessageConnector);
      triggerPortOnConnectEvent(buttonMessageConnectorSpy);
    }

    if (initList) {
      triggerPortOnConnectEvent(createPortSpyMock(AutofillOverlayPort.List));
      await flushPromises();
      listPortSpy = overlayBackground["inlineMenuListPort"];

      listMessageConnectorSpy = createPortSpyMock(AutofillOverlayPort.ListMessageConnector);
      triggerPortOnConnectEvent(listMessageConnectorSpy);
    }

    return { buttonPortSpy, listPortSpy };
  }

  beforeEach(() => {
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation(() => of(true));
    accountService = mockAccountServiceWith(mockUserId);
    fakeStateProvider = new FakeStateProvider(accountService);
    showFaviconsMock$ = new BehaviorSubject(true);
    neverDomainsMock$ = new BehaviorSubject({});
    domainSettingsService = new DefaultDomainSettingsService(
      fakeStateProvider,
      policyService,
      accountService,
    );
    domainSettingsService.showFavicons$ = showFaviconsMock$;
    domainSettingsService.neverDomains$ = neverDomainsMock$;
    logService = mock<LogService>();
    cipherService = mock<CipherService>({
      getAllDecryptedForUrl: jest.fn().mockResolvedValue([]),
    });
    autofillService = mock<AutofillService>();
    activeAccountStatusMock$ = new BehaviorSubject(AuthenticationStatus.Unlocked);
    authService = mock<AuthService>();
    authService.activeAccountStatus$ = activeAccountStatusMock$;
    environmentMock$ = new BehaviorSubject(
      new CloudEnvironment({
        key: Region.US,
        domain: "bitwarden.com",
        urls: { icons: "https://icons.bitwarden.com/" },
      }),
    );
    environmentService = mock<EnvironmentService>();
    environmentService.environment$ = environmentMock$;
    inlineMenuVisibilityMock$ = new BehaviorSubject(AutofillOverlayVisibility.OnFieldFocus);
    autofillSettingsService = mock<AutofillSettingsService>();
    autofillSettingsService.inlineMenuVisibility$ = inlineMenuVisibilityMock$;
    i18nService = mock<I18nService>();
    platformUtilsService = mock<BrowserPlatformUtilsService>();
    enablePasskeysMock$ = new BehaviorSubject(true);
    vaultSettingsServiceMock = mock<VaultSettingsService>();
    vaultSettingsServiceMock.enablePasskeys$ = enablePasskeysMock$;
    fido2ActiveRequestManager = new Fido2ActiveRequestManager();
    selectedThemeMock$ = new BehaviorSubject(ThemeType.Light);
    inlineMenuFieldQualificationService = new InlineMenuFieldQualificationService();
    themeStateService = mock<ThemeStateService>();
    themeStateService.selectedTheme$ = selectedThemeMock$;
    totpService = mock<TotpService>({
      getCode$: jest.fn().mockReturnValue(of(undefined)),
    });
    overlayBackground = new OverlayBackground(
      logService,
      cipherService,
      autofillService,
      authService,
      environmentService,
      domainSettingsService,
      autofillSettingsService,
      i18nService,
      platformUtilsService,
      vaultSettingsServiceMock,
      fido2ActiveRequestManager,
      inlineMenuFieldQualificationService,
      themeStateService,
      totpService,
      accountService,
      generatedPasswordCallbackMock,
      addPasswordCallbackMock,
    );
    portKeyForTabSpy = overlayBackground["portKeyForTab"];
    pageDetailsForTabSpy = overlayBackground["pageDetailsForTab"];
    subFrameOffsetsSpy = overlayBackground["subFrameOffsetsForTab"];
    getFrameDetailsSpy = jest.spyOn(BrowserApi, "getFrameDetails");
    getFrameDetailsSpy.mockImplementation((_details: chrome.webNavigation.GetFrameDetails) => {
      getFrameCounter--;
      return mock<chrome.webNavigation.GetFrameResultDetails>({
        parentFrameId: getFrameCounter,
      });
    });
    tabsSendMessageSpy = jest
      .spyOn(BrowserApi, "tabSendMessage")
      .mockImplementation(() => Promise.resolve());
    tabSendMessageDataSpy = jest
      .spyOn(BrowserApi, "tabSendMessageData")
      .mockImplementation(() => Promise.resolve());
    getTabFromCurrentWindowIdSpy = jest.spyOn(BrowserApi, "getTabFromCurrentWindowId");
    getTabSpy = jest.spyOn(BrowserApi, "getTab");
    openUnlockPopoutSpy = jest.spyOn(overlayBackground as any, "openUnlockPopout");

    void overlayBackground.init();
  });

  afterEach(() => {
    getFrameCounter = 2;
    jest.clearAllMocks();
    jest.useRealTimers();
    mockReset(cipherService);
  });

  describe("storing pageDetails", () => {
    const tabId = 1;

    beforeEach(() => {
      sendMockExtensionMessage(
        { command: "collectPageDetailsResponse", details: createAutofillPageDetailsMock() },
        mock<chrome.runtime.MessageSender>({ tab: createChromeTabMock({ id: tabId }), frameId: 0 }),
      );
    });

    it("stores the page details for the tab", () => {
      expect(pageDetailsForTabSpy[tabId]).toBeDefined();
    });

    describe("building sub frame offsets", () => {
      beforeEach(() => {
        tabsSendMessageSpy.mockResolvedValue(
          mock<SubFrameOffsetData>({
            left: getFrameCounter,
            top: getFrameCounter,
            url: "url",
          }),
        );
      });

      it("triggers a destruction of the inline menu listeners if the max frame depth is exceeded ", async () => {
        getFrameCounter = MAX_SUB_FRAME_DEPTH + 1;
        const tab = createChromeTabMock({ id: tabId });
        sendMockExtensionMessage(
          { command: "collectPageDetailsResponse", details: createAutofillPageDetailsMock() },
          mock<chrome.runtime.MessageSender>({
            tab,
            frameId: 1,
          }),
        );
        await flushPromises();

        expect(tabsSendMessageSpy).toHaveBeenCalledWith(
          tab,
          { command: "destroyAutofillInlineMenuListeners" },
          { frameId: 1 },
        );
      });

      it("builds the offset values for a sub frame within the tab", async () => {
        sendMockExtensionMessage(
          { command: "collectPageDetailsResponse", details: createAutofillPageDetailsMock() },
          mock<chrome.runtime.MessageSender>({
            tab: createChromeTabMock({ id: tabId }),
            frameId: 1,
          }),
        );
        await flushPromises();

        expect(subFrameOffsetsSpy[tabId]).toStrictEqual(
          new Map([[1, { left: 4, top: 4, url: "url", parentFrameIds: [0, 1] }]]),
        );
        expect(pageDetailsForTabSpy[tabId].size).toBe(2);
      });

      it("skips building offset values for a previously calculated sub frame", async () => {
        getFrameCounter = 0;
        sendMockExtensionMessage(
          { command: "collectPageDetailsResponse", details: createAutofillPageDetailsMock() },
          mock<chrome.runtime.MessageSender>({
            tab: createChromeTabMock({ id: tabId }),
            frameId: 1,
          }),
        );
        await flushPromises();

        sendMockExtensionMessage(
          { command: "collectPageDetailsResponse", details: createAutofillPageDetailsMock() },
          mock<chrome.runtime.MessageSender>({
            tab: createChromeTabMock({ id: tabId }),
            frameId: 1,
          }),
        );
        await flushPromises();

        expect(getFrameDetailsSpy).toHaveBeenCalledTimes(1);
        expect(subFrameOffsetsSpy[tabId]).toStrictEqual(
          new Map([[1, { left: 0, top: 0, url: "url", parentFrameIds: [0] }]]),
        );
      });

      it("will attempt to build the sub frame offsets by posting window messages if a set of offsets is not returned", async () => {
        const tab = createChromeTabMock({ id: tabId });
        const frameId = 1;
        tabsSendMessageSpy.mockResolvedValue(null);
        sendMockExtensionMessage(
          { command: "collectPageDetailsResponse", details: createAutofillPageDetailsMock() },
          mock<chrome.runtime.MessageSender>({ tab, frameId }),
        );
        await flushPromises();

        expect(tabsSendMessageSpy).toHaveBeenCalledWith(
          tab,
          {
            command: "getSubFrameOffsetsFromWindowMessage",
            subFrameId: frameId,
          },
          { frameId },
        );
        expect(subFrameOffsetsSpy[tabId]).toStrictEqual(new Map([[frameId, null]]));
      });

      it("updates sub frame data that has been calculated using window messages", async () => {
        const tab = createChromeTabMock({ id: tabId });
        const frameId = 1;
        const subFrameData = mock<SubFrameOffsetData>({ frameId, left: 10, top: 10, url: "url" });
        tabsSendMessageSpy.mockResolvedValueOnce(null);
        subFrameOffsetsSpy[tabId] = new Map([[frameId, null]]);

        sendMockExtensionMessage(
          { command: "updateSubFrameData", subFrameData },
          mock<chrome.runtime.MessageSender>({ tab, frameId }),
        );
        await flushPromises();

        expect(subFrameOffsetsSpy[tabId]).toStrictEqual(new Map([[frameId, subFrameData]]));
      });
    });
  });

  describe("removing pageDetails", () => {
    it("removes the page details and port key for a specific tab from the pageDetailsForTab object", async () => {
      await initOverlayElementPorts();
      const tabId = 1;
      portKeyForTabSpy[tabId] = "portKey";
      sendMockExtensionMessage(
        { command: "collectPageDetailsResponse", details: createAutofillPageDetailsMock() },
        mock<chrome.runtime.MessageSender>({ tab: createChromeTabMock({ id: tabId }), frameId: 1 }),
      );

      overlayBackground.removePageDetails(tabId);

      expect(pageDetailsForTabSpy[tabId]).toBeUndefined();
      expect(portKeyForTabSpy[tabId]).toBeUndefined();
    });
  });

  describe("re-positioning the inline menu within sub frames", () => {
    const tabId = 1;
    const topFrameId = 0;
    const middleFrameId = 10;
    const middleAdjacentFrameId = 11;
    const bottomFrameId = 20;
    let tab: chrome.tabs.Tab;
    let sender: MockProxy<chrome.runtime.MessageSender>;

    async function flushOverlayRepositionPromises() {
      await flushPromises();
      jest.advanceTimersByTime(1150);
      await flushPromises();
    }

    beforeEach(() => {
      jest.useFakeTimers();
      tab = createChromeTabMock({ id: tabId });
      sender = mock<chrome.runtime.MessageSender>({ tab, frameId: middleFrameId });
      overlayBackground["focusedFieldData"] = mock<FocusedFieldData>({
        tabId,
        frameId: bottomFrameId,
      });
      subFrameOffsetsSpy[tabId] = new Map([
        [topFrameId, { left: 1, top: 1, url: "https://top-frame.com", parentFrameIds: [] }],
        [
          middleFrameId,
          { left: 2, top: 2, url: "https://middle-frame.com", parentFrameIds: [topFrameId] },
        ],
        [
          middleAdjacentFrameId,
          {
            left: 3,
            top: 3,
            url: "https://middle-adjacent-frame.com",
            parentFrameIds: [topFrameId],
          },
        ],
        [
          bottomFrameId,
          {
            left: 4,
            top: 4,
            url: "https://bottom-frame.com",
            parentFrameIds: [topFrameId, middleFrameId],
          },
        ],
      ]);
      tabsSendMessageSpy.mockResolvedValue(
        mock<SubFrameOffsetData>({
          left: getFrameCounter,
          top: getFrameCounter,
          url: "url",
        }),
      );
    });

    describe("triggerAutofillOverlayReposition", () => {
      describe("checkShouldRepositionInlineMenu", () => {
        let focusedFieldData: FocusedFieldData;
        let repositionInlineMenuSpy: jest.SpyInstance;

        beforeEach(() => {
          focusedFieldData = createFocusedFieldDataMock({ tabId });
          repositionInlineMenuSpy = jest.spyOn(overlayBackground as any, "repositionInlineMenu");
        });

        describe("blocking a reposition of the overlay", () => {
          it("blocks repositioning when the focused field data is not set", async () => {
            overlayBackground["focusedFieldData"] = undefined;

            sendMockExtensionMessage({ command: "triggerAutofillOverlayReposition" }, sender);
            await flushOverlayRepositionPromises();

            expect(repositionInlineMenuSpy).not.toHaveBeenCalled();
          });

          it("blocks repositioning when the sender is from a different tab than the focused field", async () => {
            const otherSender = mock<chrome.runtime.MessageSender>({ frameId: 1, tab: { id: 2 } });
            sendMockExtensionMessage(
              { command: "updateFocusedFieldData", focusedFieldData },
              otherSender,
            );

            sendMockExtensionMessage({ command: "triggerAutofillOverlayReposition" }, sender);
            await flushOverlayRepositionPromises();

            expect(repositionInlineMenuSpy).not.toHaveBeenCalled();
          });

          it("blocks repositioning when the sender frame is not a parent frame of the focused field", async () => {
            focusedFieldData = createFocusedFieldDataMock({ tabId });
            const otherFrameSender = mock<chrome.runtime.MessageSender>({
              tab,
              frameId: middleAdjacentFrameId,
            });
            sendMockExtensionMessage(
              { command: "updateFocusedFieldData", focusedFieldData },
              otherFrameSender,
            );
            sender.frameId = bottomFrameId;

            sendMockExtensionMessage({ command: "triggerAutofillOverlayReposition" }, sender);
            await flushOverlayRepositionPromises();

            expect(repositionInlineMenuSpy).not.toHaveBeenCalled();
          });
        });

        describe("allowing a reposition of the overlay", () => {
          it("allows repositioning when the sender frame is for the focused field and the inline menu is visible, ", async () => {
            sendMockExtensionMessage(
              { command: "updateFocusedFieldData", focusedFieldData },
              sender,
            );
            tabsSendMessageSpy.mockImplementation((_tab, message) => {
              if (message.command === "checkIsAutofillInlineMenuButtonVisible") {
                return Promise.resolve(true);
              }
            });

            sendMockExtensionMessage({ command: "triggerAutofillOverlayReposition" }, sender);
            await flushOverlayRepositionPromises();

            expect(repositionInlineMenuSpy).toHaveBeenCalled();
          });
        });
      });

      describe("repositionInlineMenu", () => {
        beforeEach(() => {
          overlayBackground["isFieldCurrentlyFocused"] = true;
        });

        it("closes the inline menu if the field is not focused", async () => {
          overlayBackground["isFieldCurrentlyFocused"] = false;

          sendMockExtensionMessage({ command: "triggerAutofillOverlayReposition" }, sender);
          await flushOverlayRepositionPromises();

          expect(tabsSendMessageSpy).toHaveBeenCalledWith(
            tab,
            { command: "closeAutofillInlineMenu" },
            { frameId: 0 },
          );
        });

        it("closes the inline menu if the focused field is not within the viewport", async () => {
          tabsSendMessageSpy.mockImplementation((_tab, message) => {
            if (message.command === "checkIsMostRecentlyFocusedFieldWithinViewport") {
              return Promise.resolve(false);
            }
          });

          sendMockExtensionMessage({ command: "triggerAutofillOverlayReposition" }, sender);
          await flushOverlayRepositionPromises();

          expect(tabsSendMessageSpy).toHaveBeenCalledWith(
            tab,
            { command: "closeAutofillInlineMenu" },
            { frameId: 0 },
          );
        });

        it("rebuilds the sub frame offsets when the focused field's frame id indicates that it is within a sub frame", async () => {
          const focusedFieldData = createFocusedFieldDataMock({ tabId, frameId: middleFrameId });
          sendMockExtensionMessage({ command: "updateFocusedFieldData", focusedFieldData }, sender);

          sendMockExtensionMessage({ command: "triggerAutofillOverlayReposition" }, sender);
          await flushOverlayRepositionPromises();

          expect(getFrameDetailsSpy).toHaveBeenCalledWith({ tabId, frameId: middleFrameId });
        });

        describe("updating the inline menu position", () => {
          let sender: chrome.runtime.MessageSender;

          async function flushUpdateInlineMenuPromises() {
            await flushOverlayRepositionPromises();
            await flushPromises();
            jest.advanceTimersByTime(250);
            await flushPromises();
          }

          beforeEach(async () => {
            sender = mock<chrome.runtime.MessageSender>({ tab, frameId: middleFrameId });
            jest.useFakeTimers();
            await initOverlayElementPorts();
          });

          it("skips updating the position of either inline menu element if a field is not currently focused", async () => {
            sendMockExtensionMessage(
              {
                command: "updateIsFieldCurrentlyFocused",
                isFieldCurrentlyFocused: false,
              },
              mock<chrome.runtime.MessageSender>({
                tab: createChromeTabMock({ id: 1 }),
                frameId: 20,
              }),
            );

            sendMockExtensionMessage({ command: "triggerAutofillOverlayReposition" }, sender);
            await flushUpdateInlineMenuPromises();

            expect(tabsSendMessageSpy).not.toHaveBeenCalledWith(
              sender.tab,
              {
                command: "appendAutofillInlineMenuToDom",
                overlayElement: AutofillOverlayElement.Button,
              },
              { frameId: 0 },
            );
            expect(tabsSendMessageSpy).not.toHaveBeenCalledWith(
              sender.tab,
              {
                command: "appendAutofillInlineMenuToDom",
                overlayElement: AutofillOverlayElement.List,
              },
              { frameId: 0 },
            );
          });

          it("sets the inline menu invisible and updates its position", async () => {
            overlayBackground["checkIsInlineMenuButtonVisible"] = jest
              .fn()
              .mockResolvedValue(false);

            sendMockExtensionMessage({ command: "triggerAutofillOverlayReposition" }, sender);
            await flushUpdateInlineMenuPromises();

            expect(buttonPortSpy.postMessage).toHaveBeenCalledWith({
              command: "toggleAutofillInlineMenuHidden",
              styles: { display: "none" },
            });
            expect(tabsSendMessageSpy).toHaveBeenCalledWith(
              sender.tab,
              {
                command: "appendAutofillInlineMenuToDom",
                overlayElement: AutofillOverlayElement.Button,
              },
              { frameId: 0 },
            );
            expect(tabsSendMessageSpy).toHaveBeenCalledWith(
              sender.tab,
              {
                command: "appendAutofillInlineMenuToDom",
                overlayElement: AutofillOverlayElement.List,
              },
              { frameId: 0 },
            );
          });

          it("skips updating the inline menu list if the user has the inline menu set to open on button click", async () => {
            inlineMenuVisibilityMock$.next(AutofillOverlayVisibility.OnButtonClick);
            overlayBackground["inlineMenuListPort"] = null;
            tabsSendMessageSpy.mockImplementation((_tab, message, _options) => {
              if (message.command === "checkFocusedFieldHasValue") {
                return Promise.resolve(true);
              }

              return Promise.resolve({});
            });

            sendMockExtensionMessage({ command: "triggerAutofillOverlayReposition" }, sender);
            await flushUpdateInlineMenuPromises();

            expect(tabsSendMessageSpy).toHaveBeenCalledWith(
              sender.tab,
              {
                command: "appendAutofillInlineMenuToDom",
                overlayElement: AutofillOverlayElement.Button,
              },
              { frameId: 0 },
            );
            expect(tabsSendMessageSpy).not.toHaveBeenCalledWith(
              sender.tab,
              {
                command: "appendAutofillInlineMenuToDom",
                overlayElement: AutofillOverlayElement.List,
              },
              { frameId: 0 },
            );
          });

          it("skips updating the inline menu list if the focused field has a value and the user status is not unlocked", async () => {
            activeAccountStatusMock$.next(AuthenticationStatus.Locked);
            tabsSendMessageSpy.mockImplementation((_tab, message, _options) => {
              if (message.command === "checkFocusedFieldHasValue") {
                return Promise.resolve(true);
              }

              return Promise.resolve({});
            });

            sendMockExtensionMessage({ command: "triggerAutofillOverlayReposition" }, sender);
            await flushUpdateInlineMenuPromises();

            expect(tabsSendMessageSpy).toHaveBeenCalledWith(
              sender.tab,
              {
                command: "appendAutofillInlineMenuToDom",
                overlayElement: AutofillOverlayElement.Button,
              },
              { frameId: 0 },
            );
            expect(tabsSendMessageSpy).not.toHaveBeenCalledWith(
              sender.tab,
              {
                command: "appendAutofillInlineMenuToDom",
                overlayElement: AutofillOverlayElement.List,
              },
              { frameId: 0 },
            );
          });
        });
      });

      describe("triggerSubFrameFocusInRebuild", () => {
        it("triggers a rebuild of the sub frame and updates the inline menu position", async () => {
          const rebuildSubFrameOffsetsSpy = jest.spyOn(
            overlayBackground as any,
            "rebuildSubFrameOffsets",
          );
          const repositionInlineMenuSpy = jest.spyOn(
            overlayBackground as any,
            "repositionInlineMenu",
          );

          sendMockExtensionMessage({ command: "triggerSubFrameFocusInRebuild" }, sender);
          await flushOverlayRepositionPromises();

          expect(rebuildSubFrameOffsetsSpy).toHaveBeenCalled();
          expect(repositionInlineMenuSpy).toHaveBeenCalled();
        });
      });

      describe("toggleInlineMenuHidden", () => {
        beforeEach(async () => {
          await initOverlayElementPorts();
        });

        it("skips adjusting the hidden status of the inline menu if the sender tab does not contain the focused field", async () => {
          const focusedFieldData = createFocusedFieldDataMock({ tabId: 2 });
          sendMockExtensionMessage({ command: "updateFocusedFieldData", focusedFieldData }, sender);
          const otherSender = mock<chrome.runtime.MessageSender>({ tab: { id: 2 } });

          await overlayBackground["toggleInlineMenuHidden"](
            { isInlineMenuHidden: true },
            otherSender,
          );

          expect(buttonPortSpy.postMessage).not.toHaveBeenCalledWith({
            command: "toggleAutofillInlineMenuHidden",
            styles: { display: "none" },
          });
        });
      });
    });
  });

  describe("updating the overlay ciphers", () => {
    const url = "https://jest-testing-website.com";
    const tab = createChromeTabMock({ url });
    const loginCipher1 = mock<CipherView>({
      id: "id-1",
      localData: { lastUsedDate: 222 },
      name: "name-1",
      type: CipherType.Login,
      login: { username: "username-1", password: "password", uri: url },
    });
    const cardCipher = mock<CipherView>({
      id: "id-2",
      localData: { lastUsedDate: 222 },
      name: "name-2",
      type: CipherType.Card,
      card: { subTitle: "subtitle-2" },
    });
    const loginCipher2 = mock<CipherView>({
      id: "id-3",
      localData: { lastUsedDate: 222 },
      name: "name-3",
      type: CipherType.Login,
      login: { username: "username-3", uri: url },
    });
    const identityCipher = mock<CipherView>({
      id: "id-4",
      localData: { lastUsedDate: 222 },
      name: "name-4",
      type: CipherType.Identity,
      identity: {
        username: "username",
        firstName: "Test",
        lastName: "User",
        email: "email@example.com",
      },
    });
    const passkeyCipher = mock<CipherView>({
      id: "id-5",
      localData: { lastUsedDate: 222 },
      name: "name-5",
      type: CipherType.Login,
      login: {
        username: "username-5",
        password: "password",
        uri: url,
        fido2Credentials: [
          mock<Fido2CredentialView>({
            credentialId: "credential-id",
            rpName: "credential-name",
            userName: "credential-username",
            rpId: "jest-testing-website.com",
          }),
        ],
      },
    });

    beforeEach(async () => {
      activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
      await initOverlayElementPorts();
    });

    it("skips updating the overlay ciphers if the user's auth status is not unlocked", async () => {
      activeAccountStatusMock$.next(AuthenticationStatus.Locked);

      await overlayBackground.updateOverlayCiphers();

      expect(getTabFromCurrentWindowIdSpy).not.toHaveBeenCalled();
      expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
    });

    it("skips updating the inline menu ciphers if the current tab url has non-http protocol", async () => {
      const nonHttpTab = createChromeTabMock({ url: "chrome-extension://id/route" });
      getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(nonHttpTab);

      await overlayBackground.updateOverlayCiphers();

      expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
    });

    it("closes the inline menu on the focused field's tab if current tab is different", async () => {
      getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);
      cipherService.getAllDecryptedForUrl.mockResolvedValue([loginCipher1, cardCipher]);
      cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);
      const previousTab = mock<chrome.tabs.Tab>({ id: 15 });
      overlayBackground["focusedFieldData"] = createFocusedFieldDataMock({ tabId: 15 });
      getTabSpy.mockResolvedValueOnce(previousTab);

      await overlayBackground.updateOverlayCiphers();
      await flushPromises();

      expect(tabsSendMessageSpy).toHaveBeenCalledWith(
        previousTab,
        { command: "closeAutofillInlineMenu", overlayElement: undefined },
        { frameId: 0 },
      );
    });

    it("queries all cipher types, sorts them by last used, and formats them for usage in the overlay", async () => {
      getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);
      cipherService.getAllDecryptedForUrl.mockResolvedValue([loginCipher1, cardCipher]);
      cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);

      await overlayBackground.updateOverlayCiphers();
      await flushPromises();

      expect(BrowserApi.getTabFromCurrentWindowId).toHaveBeenCalled();
      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(url, mockUserId, [
        CipherType.Card,
        CipherType.Identity,
      ]);
      expect(cipherService.sortCiphersByLastUsedThenName).toHaveBeenCalled();
      expect(overlayBackground["inlineMenuCiphers"]).toStrictEqual(
        new Map([
          ["inline-menu-cipher-0", cardCipher],
          ["inline-menu-cipher-1", loginCipher1],
        ]),
      );
    });

    it("queries only login ciphers when not updating all cipher types", async () => {
      overlayBackground["cardAndIdentityCiphers"] = new Set([]);
      getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);
      cipherService.getAllDecryptedForUrl.mockResolvedValue([loginCipher2, loginCipher1]);
      cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);

      await overlayBackground.updateOverlayCiphers(false);
      await flushPromises();

      expect(BrowserApi.getTabFromCurrentWindowId).toHaveBeenCalled();
      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(url, mockUserId);
      expect(cipherService.sortCiphersByLastUsedThenName).toHaveBeenCalled();
      expect(overlayBackground["inlineMenuCiphers"]).toStrictEqual(
        new Map([
          ["inline-menu-cipher-0", loginCipher1],
          ["inline-menu-cipher-1", loginCipher2],
        ]),
      );
    });

    it("queries all cipher types when the card and identity ciphers set is not built when only updating login ciphers", async () => {
      getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);
      cipherService.getAllDecryptedForUrl.mockResolvedValue([loginCipher1, cardCipher]);
      cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);

      await overlayBackground.updateOverlayCiphers(false);
      await flushPromises();

      expect(BrowserApi.getTabFromCurrentWindowId).toHaveBeenCalled();
      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(url, mockUserId, [
        CipherType.Card,
        CipherType.Identity,
      ]);
      expect(cipherService.sortCiphersByLastUsedThenName).toHaveBeenCalled();
      expect(overlayBackground["inlineMenuCiphers"]).toStrictEqual(
        new Map([
          ["inline-menu-cipher-0", cardCipher],
          ["inline-menu-cipher-1", loginCipher1],
        ]),
      );
    });

    it("posts an `updateAutofillInlineMenuListCiphers` message to the overlay list port, and send a `updateAutofillInlineMenuListCiphers` message to the tab indicating that the list of ciphers is populated", async () => {
      overlayBackground["focusedFieldData"] = createFocusedFieldDataMock({ tabId: tab.id });
      cipherService.getAllDecryptedForUrl.mockResolvedValue([loginCipher1]);
      cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);
      getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);

      await overlayBackground.updateOverlayCiphers();
      await flushPromises();

      expect(listPortSpy.postMessage).toHaveBeenCalledWith({
        command: "updateAutofillInlineMenuListCiphers",
        showInlineMenuAccountCreation: false,
        showPasskeysLabels: false,
        focusedFieldHasValue: false,
        ciphers: [
          {
            accountCreationFieldType: undefined,
            favorite: loginCipher1.favorite,
            icon: {
              fallbackImage: "images/bwi-globe.png",
              icon: "bwi-globe",
              image: "https://icons.bitwarden.com//jest-testing-website.com/icon.png",
              imageEnabled: true,
            },
            id: "inline-menu-cipher-0",
            login: {
              username: "username-1",
              passkey: null,
              totpField: false,
            },
            name: "name-1",
            reprompt: loginCipher1.reprompt,
            type: CipherType.Login,
          },
        ],
      });
    });

    it("updates the inline menu list with card ciphers", async () => {
      overlayBackground["focusedFieldData"] = createFocusedFieldDataMock({
        tabId: tab.id,
        inlineMenuFillType: CipherType.Card,
      });
      cipherService.getAllDecryptedForUrl.mockResolvedValue([loginCipher1, cardCipher]);
      cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);
      getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);

      await overlayBackground.updateOverlayCiphers();
      await flushPromises();

      expect(listPortSpy.postMessage).toHaveBeenCalledWith({
        command: "updateAutofillInlineMenuListCiphers",
        showInlineMenuAccountCreation: false,
        showPasskeysLabels: false,
        focusedFieldHasValue: false,
        ciphers: [
          {
            accountCreationFieldType: undefined,
            favorite: cardCipher.favorite,
            icon: {
              fallbackImage: "",
              icon: "bwi-credit-card",
              image: null,
              imageEnabled: true,
            },
            id: "inline-menu-cipher-0",
            card: cardCipher.card.subTitle,
            name: cardCipher.name,
            reprompt: cardCipher.reprompt,
            type: CipherType.Card,
          },
        ],
      });
    });

    describe("updating ciphers for an account creation inline menu", () => {
      it("updates the ciphers with a list of identity ciphers that contain a username", async () => {
        overlayBackground["focusedFieldData"] = createFocusedFieldDataMock({
          tabId: tab.id,
          accountCreationFieldType: "text",
        });
        cipherService.getAllDecryptedForUrl.mockResolvedValue([identityCipher, cardCipher]);
        cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);
        getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);

        await overlayBackground.updateOverlayCiphers();
        await flushPromises();

        expect(listPortSpy.postMessage).toHaveBeenCalledWith({
          command: "updateAutofillInlineMenuListCiphers",
          showInlineMenuAccountCreation: true,
          showPasskeysLabels: false,
          focusedFieldHasValue: false,
          ciphers: [
            {
              accountCreationFieldType: "text",
              favorite: identityCipher.favorite,
              icon: {
                fallbackImage: "",
                icon: "bwi-id-card",
                image: null,
                imageEnabled: true,
              },
              id: "inline-menu-cipher-1",
              name: identityCipher.name,
              reprompt: identityCipher.reprompt,
              type: CipherType.Identity,
              identity: {
                fullName: `${identityCipher.identity.firstName} ${identityCipher.identity.lastName}`,
                username: identityCipher.identity.username,
              },
            },
          ],
        });
      });

      it("appends any found login ciphers to the list of identity ciphers", async () => {
        overlayBackground["focusedFieldData"] = createFocusedFieldDataMock({
          tabId: tab.id,
          accountCreationFieldType: "text",
          inlineMenuFillType: InlineMenuFillTypes.AccountCreationUsername,
        });
        cipherService.getAllDecryptedForUrl.mockResolvedValue([loginCipher1, identityCipher]);
        cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);
        getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);

        await overlayBackground.updateOverlayCiphers();
        await flushPromises();

        expect(listPortSpy.postMessage).toHaveBeenCalledWith({
          command: "updateAutofillInlineMenuListCiphers",
          showInlineMenuAccountCreation: true,
          showPasskeysLabels: false,
          focusedFieldHasValue: false,
          ciphers: [
            {
              accountCreationFieldType: "text",
              favorite: identityCipher.favorite,
              icon: {
                fallbackImage: "",
                icon: "bwi-id-card",
                image: null,
                imageEnabled: true,
              },
              id: "inline-menu-cipher-0",
              name: identityCipher.name,
              reprompt: identityCipher.reprompt,
              type: CipherType.Identity,
              identity: {
                fullName: `${identityCipher.identity.firstName} ${identityCipher.identity.lastName}`,
                username: identityCipher.identity.username,
              },
            },
            {
              accountCreationFieldType: "text",
              favorite: loginCipher1.favorite,
              icon: {
                fallbackImage: "images/bwi-globe.png",
                icon: "bwi-globe",
                image: "https://icons.bitwarden.com//jest-testing-website.com/icon.png",
                imageEnabled: true,
              },
              id: "inline-menu-cipher-1",
              login: {
                username: loginCipher1.login.username,
                passkey: null,
                totpField: false,
              },
              name: loginCipher1.name,
              reprompt: loginCipher1.reprompt,
              type: CipherType.Login,
            },
          ],
        });
      });

      it("skips any identity ciphers that do not contain a username or an email address", async () => {
        overlayBackground["focusedFieldData"] = createFocusedFieldDataMock({
          tabId: tab.id,
          accountCreationFieldType: "email",
        });
        const identityCipherWithoutUsername = mock<CipherView>({
          id: "id-5",
          localData: { lastUsedDate: 222 },
          name: "name-5",
          type: CipherType.Identity,
          identity: {
            username: "",
            email: "",
          },
        });
        cipherService.getAllDecryptedForUrl.mockResolvedValue([
          identityCipher,
          identityCipherWithoutUsername,
        ]);
        cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);
        getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);

        await overlayBackground.updateOverlayCiphers();
        await flushPromises();

        expect(listPortSpy.postMessage).toHaveBeenCalledWith({
          command: "updateAutofillInlineMenuListCiphers",
          showInlineMenuAccountCreation: true,
          showPasskeysLabels: false,
          focusedFieldHasValue: false,
          ciphers: [
            {
              accountCreationFieldType: "email",
              favorite: identityCipher.favorite,
              icon: {
                fallbackImage: "",
                icon: "bwi-id-card",
                image: null,
                imageEnabled: true,
              },
              id: "inline-menu-cipher-1",
              name: identityCipher.name,
              reprompt: identityCipher.reprompt,
              type: CipherType.Identity,
              identity: {
                fullName: `${identityCipher.identity.firstName} ${identityCipher.identity.lastName}`,
                username: identityCipher.identity.email,
              },
            },
          ],
        });
      });

      it("does not add the identity ciphers if the field is for a password field", async () => {
        overlayBackground["focusedFieldData"] = createFocusedFieldDataMock({
          tabId: tab.id,
          accountCreationFieldType: "password",
        });
        cipherService.getAllDecryptedForUrl.mockResolvedValue([identityCipher]);
        cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);
        getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);

        await overlayBackground.updateOverlayCiphers();
        await flushPromises();

        expect(listPortSpy.postMessage).toHaveBeenCalledWith({
          command: "updateAutofillInlineMenuListCiphers",
          showInlineMenuAccountCreation: true,
          showPasskeysLabels: false,
          focusedFieldHasValue: false,
          ciphers: [],
        });
      });
    });

    it("adds available passkey ciphers to the inline menu", async () => {
      void fido2ActiveRequestManager.newActiveRequest(
        tab.id,
        passkeyCipher.login.fido2Credentials,
        new AbortController(),
      );
      overlayBackground["focusedFieldData"] = createFocusedFieldDataMock({
        tabId: tab.id,
        inlineMenuFillType: CipherType.Login,
        showPasskeys: true,
      });
      cipherService.getAllDecryptedForUrl.mockResolvedValue([loginCipher1, passkeyCipher]);
      cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);
      getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);

      await overlayBackground.updateOverlayCiphers();
      await flushPromises();

      expect(listPortSpy.postMessage).toHaveBeenCalledWith({
        command: "updateAutofillInlineMenuListCiphers",
        ciphers: [
          {
            id: "inline-menu-cipher-0",
            name: passkeyCipher.name,
            type: CipherType.Login,
            reprompt: passkeyCipher.reprompt,
            favorite: passkeyCipher.favorite,
            icon: {
              fallbackImage: "images/bwi-globe.png",
              icon: "bwi-globe",
              image: "https://icons.bitwarden.com//jest-testing-website.com/icon.png",
              imageEnabled: true,
            },
            accountCreationFieldType: undefined,
            login: {
              username: passkeyCipher.login.username,
              passkey: {
                rpName: passkeyCipher.login.fido2Credentials[0].rpName,
                userName: passkeyCipher.login.fido2Credentials[0].userName,
              },
              totpField: false,
            },
          },
          {
            id: "inline-menu-cipher-0",
            name: passkeyCipher.name,
            type: CipherType.Login,
            reprompt: passkeyCipher.reprompt,
            favorite: passkeyCipher.favorite,
            icon: {
              fallbackImage: "images/bwi-globe.png",
              icon: "bwi-globe",
              image: "https://icons.bitwarden.com//jest-testing-website.com/icon.png",
              imageEnabled: true,
            },
            accountCreationFieldType: undefined,
            login: {
              username: passkeyCipher.login.username,
              passkey: null,
              totpField: false,
            },
          },
          {
            id: "inline-menu-cipher-1",
            name: loginCipher1.name,
            type: CipherType.Login,
            reprompt: loginCipher1.reprompt,
            favorite: loginCipher1.favorite,
            icon: {
              fallbackImage: "images/bwi-globe.png",
              icon: "bwi-globe",
              image: "https://icons.bitwarden.com//jest-testing-website.com/icon.png",
              imageEnabled: true,
            },
            accountCreationFieldType: undefined,
            login: {
              username: loginCipher1.login.username,
              passkey: null,
              totpField: false,
            },
          },
        ],
        showInlineMenuAccountCreation: false,
        showPasskeysLabels: true,
        focusedFieldHasValue: false,
      });
    });

    it("does not add a passkey to the inline menu when its rpId is part of the neverDomains exclusion list", async () => {
      void fido2ActiveRequestManager.newActiveRequest(
        tab.id,
        passkeyCipher.login.fido2Credentials,
        new AbortController(),
      );
      overlayBackground["focusedFieldData"] = createFocusedFieldDataMock({
        tabId: tab.id,
        inlineMenuFillType: CipherType.Login,
        showPasskeys: true,
      });
      cipherService.getAllDecryptedForUrl.mockResolvedValue([loginCipher1, passkeyCipher]);
      cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);
      getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);
      neverDomainsMock$.next({ "jest-testing-website.com": null });

      await overlayBackground.updateOverlayCiphers();
      await flushPromises();

      expect(listPortSpy.postMessage).toHaveBeenCalledWith({
        command: "updateAutofillInlineMenuListCiphers",
        ciphers: [
          {
            id: "inline-menu-cipher-0",
            name: passkeyCipher.name,
            type: CipherType.Login,
            reprompt: passkeyCipher.reprompt,
            favorite: passkeyCipher.favorite,
            icon: {
              fallbackImage: "images/bwi-globe.png",
              icon: "bwi-globe",
              image: "https://icons.bitwarden.com//jest-testing-website.com/icon.png",
              imageEnabled: true,
            },
            accountCreationFieldType: undefined,
            login: {
              username: passkeyCipher.login.username,
              passkey: null,
              totpField: false,
            },
          },
          {
            id: "inline-menu-cipher-1",
            name: loginCipher1.name,
            type: CipherType.Login,
            reprompt: loginCipher1.reprompt,
            favorite: loginCipher1.favorite,
            icon: {
              fallbackImage: "images/bwi-globe.png",
              icon: "bwi-globe",
              image: "https://icons.bitwarden.com//jest-testing-website.com/icon.png",
              imageEnabled: true,
            },
            accountCreationFieldType: undefined,
            login: {
              username: loginCipher1.login.username,
              passkey: null,
              totpField: false,
            },
          },
        ],
        showInlineMenuAccountCreation: false,
        showPasskeysLabels: false,
        focusedFieldHasValue: false,
      });
    });

    it("does not add passkeys to the inline menu if the passkey setting is disabled", async () => {
      enablePasskeysMock$.next(false);
      void fido2ActiveRequestManager.newActiveRequest(
        tab.id,
        passkeyCipher.login.fido2Credentials,
        new AbortController(),
      );
      overlayBackground["focusedFieldData"] = createFocusedFieldDataMock({
        tabId: tab.id,
        inlineMenuFillType: CipherType.Login,
        showPasskeys: true,
      });
      cipherService.getAllDecryptedForUrl.mockResolvedValue([loginCipher1, passkeyCipher]);
      cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);
      getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);

      await overlayBackground.updateOverlayCiphers();
      await flushPromises();

      expect(listPortSpy.postMessage).toHaveBeenCalledWith({
        command: "updateAutofillInlineMenuListCiphers",
        ciphers: [
          {
            id: "inline-menu-cipher-0",
            name: passkeyCipher.name,
            type: CipherType.Login,
            reprompt: passkeyCipher.reprompt,
            favorite: passkeyCipher.favorite,
            icon: {
              fallbackImage: "images/bwi-globe.png",
              icon: "bwi-globe",
              image: "https://icons.bitwarden.com//jest-testing-website.com/icon.png",
              imageEnabled: true,
            },
            accountCreationFieldType: undefined,
            login: {
              username: passkeyCipher.login.username,
              passkey: null,
              totpField: false,
            },
          },
          {
            id: "inline-menu-cipher-1",
            name: loginCipher1.name,
            type: CipherType.Login,
            reprompt: loginCipher1.reprompt,
            favorite: loginCipher1.favorite,
            icon: {
              fallbackImage: "images/bwi-globe.png",
              icon: "bwi-globe",
              image: "https://icons.bitwarden.com//jest-testing-website.com/icon.png",
              imageEnabled: true,
            },
            accountCreationFieldType: undefined,
            login: {
              username: loginCipher1.login.username,
              passkey: null,
              totpField: false,
            },
          },
        ],
        showInlineMenuAccountCreation: false,
        showPasskeysLabels: false,
        focusedFieldHasValue: false,
      });
    });

    it("updates the inline menu list with login ciphers when the field fill type is for updating the current password", async () => {
      sendMockExtensionMessage(
        {
          command: "updateFocusedFieldData",
          focusedFieldData: createFocusedFieldDataMock({
            inlineMenuFillType: InlineMenuFillTypes.CurrentPasswordUpdate,
          }),
        },
        mock<chrome.runtime.MessageSender>({ tab }),
      );
      getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(tab);
      cipherService.getAllDecryptedForUrl.mockResolvedValue([loginCipher2, loginCipher1]);
      cipherService.sortCiphersByLastUsedThenName.mockReturnValue(-1);

      await overlayBackground.updateOverlayCiphers(false);
      await flushPromises();

      expect(listPortSpy.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          ciphers: [
            {
              id: "inline-menu-cipher-0",
              name: loginCipher1.name,
              type: CipherType.Login,
              reprompt: loginCipher1.reprompt,
              favorite: loginCipher1.favorite,
              icon: {
                fallbackImage: "images/bwi-globe.png",
                icon: "bwi-globe",
                image: "https://icons.bitwarden.com//jest-testing-website.com/icon.png",
                imageEnabled: true,
              },
              accountCreationFieldType: undefined,
              login: {
                username: loginCipher1.login.username,
                passkey: null,
                totpField: false,
              },
            },
            {
              id: "inline-menu-cipher-1",
              name: loginCipher2.name,
              type: CipherType.Login,
              reprompt: loginCipher2.reprompt,
              favorite: loginCipher2.favorite,
              icon: {
                fallbackImage: "images/bwi-globe.png",
                icon: "bwi-globe",
                image: "https://icons.bitwarden.com//jest-testing-website.com/icon.png",
                imageEnabled: true,
              },
              accountCreationFieldType: undefined,
              login: {
                username: loginCipher2.login.username,
                passkey: null,
                totpField: false,
              },
            },
          ],
        }),
      );
    });
  });

  describe("extension message handlers", () => {
    describe("autofillOverlayElementClosed message handler", () => {
      beforeEach(async () => {
        await initOverlayElementPorts();
      });

      it("disconnects any expired ports if the sender is not from the same page as the most recently focused field", () => {
        const port1 = mock<chrome.runtime.Port>();
        const port2 = mock<chrome.runtime.Port>();
        overlayBackground["expiredPorts"] = [port1, port2];
        const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });
        const focusedFieldData = createFocusedFieldDataMock({ tabId: 2 });
        sendMockExtensionMessage({ command: "updateFocusedFieldData", focusedFieldData });

        sendMockExtensionMessage(
          {
            command: "autofillOverlayElementClosed",
            overlayElement: AutofillOverlayElement.Button,
          },
          sender,
        );

        expect(port1.disconnect).toHaveBeenCalled();
        expect(port2.disconnect).toHaveBeenCalled();
      });

      it("disconnects the button element port", () => {
        sendMockExtensionMessage({
          command: "autofillOverlayElementClosed",
          overlayElement: AutofillOverlayElement.Button,
        });

        expect(buttonPortSpy.disconnect).toHaveBeenCalled();
      });

      it("disconnects the list element port", () => {
        sendMockExtensionMessage({
          command: "autofillOverlayElementClosed",
          overlayElement: AutofillOverlayElement.List,
        });

        expect(listPortSpy.disconnect).toHaveBeenCalled();
      });
    });

    describe("autofillOverlayAddNewVaultItem message handler", () => {
      let sender: chrome.runtime.MessageSender;
      let openAddEditVaultItemPopoutSpy: jest.SpyInstance;

      beforeEach(() => {
        jest.useFakeTimers();
        sender = mock<chrome.runtime.MessageSender>({
          tab: { id: 1 },
          url: "https://top-frame-test.com",
          frameId: 0,
        });
        openAddEditVaultItemPopoutSpy = jest
          .spyOn(overlayBackground as any, "openAddEditVaultItemPopout")
          .mockImplementation();
        overlayBackground["currentAddNewItemData"] = { sender, addNewCipherType: CipherType.Login };
      });

      it("will not open the add edit popout window if the message does not have a login cipher provided", () => {
        sendMockExtensionMessage({ command: "autofillOverlayAddNewVaultItem" }, sender);

        expect(cipherService.setAddEditCipherInfo).not.toHaveBeenCalled();
        expect(openAddEditVaultItemPopoutSpy).not.toHaveBeenCalled();
      });

      it("resets the currentAddNewItemData to null when a cipher view is not successfully created", async () => {
        jest.spyOn(overlayBackground as any, "buildLoginCipherView").mockReturnValue(null);

        sendMockExtensionMessage(
          {
            command: "autofillOverlayAddNewVaultItem",
            addNewCipherType: CipherType.Login,
            login: {
              uri: "https://tacos.com",
              hostname: "",
              username: "username",
              password: "password",
            },
          },
          sender,
        );
        jest.advanceTimersByTime(100);
        await flushPromises();

        expect(overlayBackground["currentAddNewItemData"]).toBeNull();
      });

      it("will open the add edit popout window after creating a new cipher", async () => {
        sendMockExtensionMessage(
          {
            command: "autofillOverlayAddNewVaultItem",
            addNewCipherType: CipherType.Login,
            login: {
              uri: "https://tacos.com",
              hostname: "",
              username: "username",
              password: "password",
            },
          },
          sender,
        );
        jest.advanceTimersByTime(100);
        await flushPromises();

        expect(cipherService.setAddEditCipherInfo).toHaveBeenCalled();
        expect(openAddEditVaultItemPopoutSpy).toHaveBeenCalled();
      });

      it("creates a new card cipher", async () => {
        overlayBackground["currentAddNewItemData"].addNewCipherType = CipherType.Card;

        sendMockExtensionMessage(
          {
            command: "autofillOverlayAddNewVaultItem",
            addNewCipherType: CipherType.Card,
            card: {
              cardholderName: "cardholderName",
              number: "4242424242424242",
              expirationMonth: "12",
              expirationYear: "2025",
              expirationDate: "12/25",
              cvv: "123",
            },
          },
          sender,
        );
        jest.advanceTimersByTime(100);
        await flushPromises();

        expect(cipherService.setAddEditCipherInfo).toHaveBeenCalled();
        expect(openAddEditVaultItemPopoutSpy).toHaveBeenCalled();
      });

      describe("creating a new identity cipher", () => {
        beforeEach(() => {
          overlayBackground["currentAddNewItemData"].addNewCipherType = CipherType.Identity;
        });

        it("populates an identity cipher view and creates it", async () => {
          sendMockExtensionMessage(
            {
              command: "autofillOverlayAddNewVaultItem",
              addNewCipherType: CipherType.Identity,
              identity: {
                title: "title",
                firstName: "firstName",
                middleName: "middleName",
                lastName: "lastName",
                fullName: "fullName",
                address1: "address1",
                address2: "address2",
                address3: "address3",
                city: "city",
                state: "state",
                postalCode: "postalCode",
                country: "country",
                company: "company",
                phone: "phone",
                email: "email",
                username: "username",
              },
            },
            sender,
          );
          jest.advanceTimersByTime(100);
          await flushPromises();

          expect(cipherService.setAddEditCipherInfo).toHaveBeenCalled();
          expect(openAddEditVaultItemPopoutSpy).toHaveBeenCalled();
        });

        it("saves the first name based on the full name value", async () => {
          sendMockExtensionMessage(
            {
              command: "autofillOverlayAddNewVaultItem",
              addNewCipherType: CipherType.Identity,
              identity: {
                firstName: "",
                lastName: "",
                fullName: "fullName",
              },
            },
            sender,
          );
          jest.advanceTimersByTime(100);
          await flushPromises();

          expect(cipherService.setAddEditCipherInfo).toHaveBeenCalled();
        });

        it("saves the first and middle names based on the full name value", async () => {
          sendMockExtensionMessage(
            {
              command: "autofillOverlayAddNewVaultItem",
              addNewCipherType: CipherType.Identity,
              identity: {
                firstName: "",
                lastName: "",
                fullName: "firstName middleName",
              },
            },
            sender,
          );
          jest.advanceTimersByTime(100);
          await flushPromises();

          expect(cipherService.setAddEditCipherInfo).toHaveBeenCalled();
        });

        it("saves the first, middle, and last names based on the full name value", async () => {
          sendMockExtensionMessage(
            {
              command: "autofillOverlayAddNewVaultItem",
              addNewCipherType: CipherType.Identity,
              identity: {
                firstName: "",
                lastName: "",
                fullName: "firstName middleName lastName",
              },
            },
            sender,
          );
          jest.advanceTimersByTime(100);
          await flushPromises();

          expect(cipherService.setAddEditCipherInfo).toHaveBeenCalled();
        });
      });

      describe("pulling cipher data from multiple frames of a tab", () => {
        let subFrameSender: MockProxy<chrome.runtime.MessageSender>;
        let secondSubFrameSender: MockProxy<chrome.runtime.MessageSender>;
        const command = "autofillOverlayAddNewVaultItem";

        beforeEach(() => {
          subFrameSender = mock<chrome.runtime.MessageSender>({ tab: sender.tab, frameId: 2 });
          secondSubFrameSender = mock<chrome.runtime.MessageSender>({
            tab: sender.tab,
            frameId: 3,
          });
        });

        it("combines the login cipher data from all frames", async () => {
          const buildLoginCipherViewSpy = jest.spyOn(
            overlayBackground as any,
            "buildLoginCipherView",
          );
          const addNewCipherType = CipherType.Login;
          const topLevelLoginCipherData = {
            uri: "https://top-frame-test.com",
            hostname: "top-frame-test.com",
            username: "",
            password: "",
          };
          const loginCipherData = {
            uri: "https://tacos.com",
            hostname: "tacos.com",
            username: "username",
            password: "",
          };
          const subFrameLoginCipherData = {
            uri: "https://tacos.com",
            hostname: "tacos.com",
            username: "",
            password: "password",
          };

          sendMockExtensionMessage(
            { command, addNewCipherType, login: topLevelLoginCipherData },
            sender,
          );
          sendMockExtensionMessage(
            { command, addNewCipherType, login: loginCipherData },
            subFrameSender,
          );
          sendMockExtensionMessage(
            { command, addNewCipherType, login: subFrameLoginCipherData },
            secondSubFrameSender,
          );
          jest.advanceTimersByTime(100);
          await flushPromises();

          expect(buildLoginCipherViewSpy).toHaveBeenCalledWith({
            uri: "https://top-frame-test.com",
            hostname: "top-frame-test.com",
            username: "username",
            password: "password",
          });
        });

        it("sets the uri to the subframe of a tab if the login data is complete", async () => {
          const buildLoginCipherViewSpy = jest.spyOn(
            overlayBackground as any,
            "buildLoginCipherView",
          );
          const addNewCipherType = CipherType.Login;
          const loginCipherData = {
            uri: "https://tacos.com",
            hostname: "tacos.com",
            username: "username",
            password: "password",
          };
          const topLevelLoginCipherData = {
            uri: "https://top-frame-test.com",
            hostname: "top-frame-test.com",
            username: "",
            password: "",
          };

          sendMockExtensionMessage(
            { command, addNewCipherType, login: loginCipherData },
            subFrameSender,
          );
          sendMockExtensionMessage(
            { command, addNewCipherType, login: topLevelLoginCipherData },
            sender,
          );
          jest.advanceTimersByTime(100);
          await flushPromises();

          expect(buildLoginCipherViewSpy).toHaveBeenCalledWith({
            uri: "https://tacos.com",
            hostname: "tacos.com",
            username: "username",
            password: "password",
          });
        });

        it("combines the card cipher data from all frames", async () => {
          const buildCardCipherViewSpy = jest.spyOn(
            overlayBackground as any,
            "buildCardCipherView",
          );
          overlayBackground["currentAddNewItemData"].addNewCipherType = CipherType.Card;
          const addNewCipherType = CipherType.Card;
          const cardCipherData = {
            cardholderName: "cardholderName",
            number: "",
            expirationMonth: "",
            expirationYear: "",
            expirationDate: "12/25",
            cvv: "123",
          };
          const subFrameCardCipherData = {
            cardholderName: "",
            number: "4242424242424242",
            expirationMonth: "12",
            expirationYear: "2025",
            expirationDate: "",
            cvv: "",
          };

          sendMockExtensionMessage({ command, addNewCipherType, card: cardCipherData }, sender);
          sendMockExtensionMessage(
            { command, addNewCipherType, card: subFrameCardCipherData },
            subFrameSender,
          );
          jest.advanceTimersByTime(100);
          await flushPromises();

          expect(buildCardCipherViewSpy).toHaveBeenCalledWith({
            cardholderName: "cardholderName",
            number: "4242424242424242",
            expirationMonth: "12",
            expirationYear: "2025",
            expirationDate: "12/25",
            cvv: "123",
          });
        });

        it("combines the identity cipher data from all frames", async () => {
          const buildIdentityCipherViewSpy = jest.spyOn(
            overlayBackground as any,
            "buildIdentityCipherView",
          );
          overlayBackground["currentAddNewItemData"].addNewCipherType = CipherType.Identity;
          const addNewCipherType = CipherType.Identity;
          const identityCipherData = {
            title: "title",
            firstName: "firstName",
            middleName: "middleName",
            lastName: "",
            fullName: "",
            address1: "address1",
            address2: "address2",
            address3: "address3",
            city: "city",
            state: "state",
            postalCode: "postalCode",
            country: "country",
            company: "company",
            phone: "phone",
            email: "email",
            username: "username",
          };
          const subFrameIdentityCipherData = {
            title: "",
            firstName: "",
            middleName: "",
            lastName: "lastName",
            fullName: "fullName",
            address1: "",
            address2: "",
            address3: "",
            city: "",
            state: "",
            postalCode: "",
            country: "",
            company: "",
            phone: "",
            email: "",
            username: "",
          };

          sendMockExtensionMessage(
            { command, addNewCipherType, identity: identityCipherData },
            sender,
          );
          sendMockExtensionMessage(
            { command, addNewCipherType, identity: subFrameIdentityCipherData },
            subFrameSender,
          );
          jest.advanceTimersByTime(100);
          await flushPromises();

          expect(buildIdentityCipherViewSpy).toHaveBeenCalledWith({
            title: "title",
            firstName: "firstName",
            middleName: "middleName",
            lastName: "lastName",
            fullName: "fullName",
            address1: "address1",
            address2: "address2",
            address3: "address3",
            city: "city",
            state: "state",
            postalCode: "postalCode",
            country: "country",
            company: "company",
            phone: "phone",
            email: "email",
            username: "username",
          });
        });
      });
    });

    describe("checkIsInlineMenuCiphersPopulated message handler", () => {
      let focusedFieldData: FocusedFieldData;

      beforeEach(() => {
        focusedFieldData = createFocusedFieldDataMock();
        sendMockExtensionMessage(
          { command: "updateFocusedFieldData", focusedFieldData },
          mock<chrome.runtime.MessageSender>({ tab: { id: 2 }, frameId: 0 }),
        );
      });

      it("returns false if the sender's tab id is not equal to the focused field's tab id", async () => {
        const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });

        sendMockExtensionMessage(
          { command: "checkIsInlineMenuCiphersPopulated" },
          sender,
          sendResponse,
        );
        await flushPromises();

        expect(sendResponse).toHaveBeenCalledWith(false);
      });

      it("returns false if the overlay login cipher are not populated", () => {});

      it("returns true if the overlay login ciphers are populated", async () => {
        overlayBackground["inlineMenuCiphers"] = new Map([
          [
            "inline-menu-cipher-0",
            mock<CipherView>({
              type: CipherType.Login,
              login: {
                username: "username1",
                password: "password1",
                uri: "https://example.com",
              },
            }),
          ],
        ]);
        await overlayBackground["getInlineMenuCipherData"]();

        sendMockExtensionMessage(
          { command: "checkIsInlineMenuCiphersPopulated" },
          mock<chrome.runtime.MessageSender>({ tab: { id: 2 } }),
          sendResponse,
        );
        await flushPromises();

        expect(sendResponse).toHaveBeenCalledWith(true);
      });
    });

    describe("updateFocusedFieldData message handler", () => {
      it("sends a message to the sender frame to unset the most recently focused field data when the currently focused field does not belong to the sender", async () => {
        const tab = createChromeTabMock({ id: 2 });
        const firstSender = mock<chrome.runtime.MessageSender>({ tab, frameId: 100 });
        const focusedFieldData = createFocusedFieldDataMock({
          tabId: tab.id,
          frameId: firstSender.frameId,
        });
        sendMockExtensionMessage(
          { command: "updateFocusedFieldData", focusedFieldData },
          firstSender,
        );
        await flushPromises();

        const secondSender = mock<chrome.runtime.MessageSender>({ tab, frameId: 10 });
        const otherFocusedFieldData = createFocusedFieldDataMock({
          tabId: tab.id,
          frameId: secondSender.frameId,
        });
        sendMockExtensionMessage(
          { command: "updateFocusedFieldData", focusedFieldData: otherFocusedFieldData },
          secondSender,
        );
        await flushPromises();

        expect(tabsSendMessageSpy).toHaveBeenCalledWith(
          tab,
          { command: "unsetMostRecentlyFocusedField" },
          { frameId: firstSender.frameId },
        );
      });

      it("triggers an update of the identity ciphers present on a login field", async () => {
        await initOverlayElementPorts();
        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        const tab = createChromeTabMock({ id: 2 });
        overlayBackground["focusedFieldData"] = createFocusedFieldDataMock();
        overlayBackground["isInlineMenuButtonVisible"] = true;
        const sender = mock<chrome.runtime.MessageSender>({ tab, frameId: 100 });
        const focusedFieldData = createFocusedFieldDataMock({
          tabId: tab.id,
          frameId: sender.frameId,
        });

        sendMockExtensionMessage({ command: "updateFocusedFieldData", focusedFieldData }, sender);
        await flushPromises();

        expect(listPortSpy.postMessage).toHaveBeenCalledWith({
          command: "updateAutofillInlineMenuListCiphers",
          ciphers: [],
          showInlineMenuAccountCreation: true,
          showPasskeysLabels: false,
          focusedFieldHasValue: false,
        });
      });

      it("triggers an update of the inline menu ciphers when the new focused field's cipher type does not equal the previous focused field's cipher type", async () => {
        const updateOverlayCiphersSpy = jest.spyOn(overlayBackground, "updateOverlayCiphers");
        const tab = createChromeTabMock({ id: 2 });
        const sender = mock<chrome.runtime.MessageSender>({ tab, frameId: 100 });
        const focusedFieldData = createFocusedFieldDataMock({
          tabId: tab.id,
          frameId: sender.frameId,
          inlineMenuFillType: CipherType.Login,
        });
        sendMockExtensionMessage({ command: "updateFocusedFieldData", focusedFieldData }, sender);
        await flushPromises();

        const newFocusedFieldData = createFocusedFieldDataMock({
          tabId: tab.id,
          frameId: sender.frameId,
          inlineMenuFillType: CipherType.Card,
        });
        sendMockExtensionMessage(
          { command: "updateFocusedFieldData", focusedFieldData: newFocusedFieldData },
          sender,
        );
        await flushPromises();

        expect(updateOverlayCiphersSpy).toHaveBeenCalled();
      });

      describe("displaying the password generation menu", () => {
        const tab = createChromeTabMock({ id: 2 });
        const sender = mock<chrome.runtime.MessageSender>({ tab, frameId: 100 });
        let focusedFieldData: FocusedFieldData;

        beforeEach(async () => {
          await initOverlayElementPorts();
          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          overlayBackground["focusedFieldData"] = createFocusedFieldDataMock();
          overlayBackground["isInlineMenuButtonVisible"] = true;
          focusedFieldData = createFocusedFieldDataMock({
            tabId: tab.id,
            frameId: sender.frameId,
          });
        });

        it("displays the password generator when the focused field is for password generation", async () => {
          focusedFieldData.inlineMenuFillType = InlineMenuFillTypes.PasswordGeneration;

          sendMockExtensionMessage({ command: "updateFocusedFieldData", focusedFieldData }, sender);
          await flushPromises();

          expect(listPortSpy.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
              command: "updateAutofillInlineMenuGeneratedPassword",
            }),
          );
        });

        it("displays the password generator when the focused field is for login and the field has an account creation type of password", async () => {
          focusedFieldData.inlineMenuFillType = CipherType.Login;
          focusedFieldData.accountCreationFieldType = InlineMenuAccountCreationFieldType.Password;

          sendMockExtensionMessage({ command: "updateFocusedFieldData", focusedFieldData }, sender);
          await flushPromises();

          expect(listPortSpy.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
              command: "updateAutofillInlineMenuGeneratedPassword",
            }),
          );
        });
      });

      describe("displaying the save login menu", () => {
        const tab = createChromeTabMock({ id: 2 });
        const sender = mock<chrome.runtime.MessageSender>({ tab, frameId: 100 });
        let focusedFieldData: FocusedFieldData;
        let formData: ModifyLoginCipherFormData;

        beforeEach(async () => {
          await initOverlayElementPorts();
          activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
          overlayBackground["focusedFieldData"] = createFocusedFieldDataMock();
          overlayBackground["isInlineMenuButtonVisible"] = true;
          focusedFieldData = createFocusedFieldDataMock({
            tabId: tab.id,
            frameId: sender.frameId,
          });
          formData = {
            uri: "https://example.com",
            username: "username",
            password: "password",
            newPassword: "newPassword",
          };
          tabsSendMessageSpy.mockImplementation((_tab, message) => {
            if (message.command === "getInlineMenuFormFieldData") {
              return Promise.resolve(formData);
            }

            return Promise.resolve();
          });
        });

        it("shows the save login menu when the focused field type is for password generation and the field is filled", async () => {
          focusedFieldData.inlineMenuFillType = InlineMenuFillTypes.PasswordGeneration;

          sendMockExtensionMessage(
            { command: "updateFocusedFieldData", focusedFieldData, focusedFieldHasValue: true },
            sender,
          );
          await flushPromises();

          expect(listPortSpy.postMessage).toHaveBeenCalledWith({
            command: "showSaveLoginInlineMenuList",
          });
        });

        it("shows the save login menu when the focused field type is for a login cipher and the field is filled", async () => {
          focusedFieldData.inlineMenuFillType = CipherType.Login;

          sendMockExtensionMessage(
            { command: "updateFocusedFieldData", focusedFieldData, focusedFieldHasValue: true },
            sender,
          );
          await flushPromises();

          expect(listPortSpy.postMessage).toHaveBeenCalledWith({
            command: "showSaveLoginInlineMenuList",
          });
        });
      });
    });

    describe("updateIsFieldCurrentlyFocused message handler", () => {
      it("skips updating the isFiledCurrentlyFocused value when the focused field data is populated and the sender frame id does not equal the focused field's frame id", async () => {
        const focusedFieldData = createFocusedFieldDataMock();
        sendMockExtensionMessage(
          { command: "updateFocusedFieldData", focusedFieldData },
          mock<chrome.runtime.MessageSender>({ tab: { id: 1 }, frameId: 10 }),
        );
        overlayBackground["isFieldCurrentlyFocused"] = true;

        sendMockExtensionMessage(
          { command: "updateIsFieldCurrentlyFocused", isFieldCurrentlyFocused: false },
          mock<chrome.runtime.MessageSender>({ tab: { id: 1 }, frameId: 20 }),
        );
        await flushPromises();

        expect(overlayBackground["isFieldCurrentlyFocused"]).toBe(true);
      });
    });

    describe("updateIsFieldCurrentlyFocused message handler", () => {
      it("skips updating the isFiledCurrentlyFocused value when the focused field data is populated and the sender frame id does not equal the focused field's frame id", async () => {
        const focusedFieldData = createFocusedFieldDataMock();
        sendMockExtensionMessage(
          { command: "updateFocusedFieldData", focusedFieldData },
          mock<chrome.runtime.MessageSender>({ tab: { id: 1 }, frameId: 10 }),
        );
        overlayBackground["isFieldCurrentlyFocused"] = true;

        sendMockExtensionMessage(
          { command: "updateIsFieldCurrentlyFocused", isFieldCurrentlyFocused: false },
          mock<chrome.runtime.MessageSender>({ tab: { id: 1 }, frameId: 20 }),
        );
        await flushPromises();

        expect(overlayBackground["isFieldCurrentlyFocused"]).toBe(true);
      });
    });

    describe("checkIsFieldCurrentlyFocused message handler", () => {
      it("returns true when a form field is currently focused", async () => {
        sendMockExtensionMessage({
          command: "updateIsFieldCurrentlyFocused",
          isFieldCurrentlyFocused: true,
        });

        sendMockExtensionMessage(
          { command: "checkIsFieldCurrentlyFocused" },
          mock<chrome.runtime.MessageSender>(),
          sendResponse,
        );
        await flushPromises();

        expect(sendResponse).toHaveBeenCalledWith(true);
      });
    });

    describe("checkIsFieldCurrentlyFilling message handler", () => {
      it("returns true if autofill is currently running", async () => {
        sendMockExtensionMessage({
          command: "updateIsFieldCurrentlyFilling",
          isFieldCurrentlyFilling: true,
        });

        sendMockExtensionMessage(
          { command: "checkIsFieldCurrentlyFilling" },
          mock<chrome.runtime.MessageSender>(),
          sendResponse,
        );
        await flushPromises();

        expect(sendResponse).toHaveBeenCalledWith(true);
      });
    });

    describe("getAutofillInlineMenuVisibility message handler", () => {
      it("returns the current inline menu visibility setting", async () => {
        sendMockExtensionMessage(
          { command: "getAutofillInlineMenuVisibility" },
          mock<chrome.runtime.MessageSender>(),
          sendResponse,
        );
        await flushPromises();

        expect(sendResponse).toHaveBeenCalledWith(AutofillOverlayVisibility.OnFieldFocus);
      });
    });

    describe("openAutofillInlineMenu message handler", () => {
      let sender: chrome.runtime.MessageSender;
      const topFrameSendOptions = { frameId: 0 };

      beforeEach(() => {
        sender = mock<chrome.runtime.MessageSender>({
          tab: createChromeTabMock({ id: 1, url: "https://jest-testing-website.com" }),
        });
        getTabFromCurrentWindowIdSpy.mockResolvedValue(sender.tab);
        tabsSendMessageSpy.mockImplementation();
        sendMockExtensionMessage(
          { command: "updateFocusedFieldData", focusedFieldData: createFocusedFieldDataMock() },
          sender,
        );
      });

      it("updates the inline menu position of both button and list elements if the inline menu is being forced open", async () => {
        sendMockExtensionMessage(
          { command: "openAutofillInlineMenu", isOpeningFullInlineMenu: true },
          sender,
        );
        await flushPromises();

        expect(tabsSendMessageSpy).toHaveBeenCalledWith(
          sender.tab,
          {
            command: "appendAutofillInlineMenuToDom",
            overlayElement: AutofillOverlayElement.Button,
          },
          topFrameSendOptions,
        );
        expect(tabsSendMessageSpy).toHaveBeenCalledWith(
          sender.tab,
          {
            command: "appendAutofillInlineMenuToDom",
            overlayElement: AutofillOverlayElement.List,
          },
          topFrameSendOptions,
        );
      });

      describe("when the focused field does not have a value", () => {
        beforeEach(() => {
          jest
            .spyOn(overlayBackground as any, "checkFocusedFieldHasValue")
            .mockResolvedValue(false);
        });

        it("updates the position of the both button and list elements if the user has the inline menu set to show on field focus", async () => {
          inlineMenuVisibilityMock$.next(AutofillOverlayVisibility.OnFieldFocus);

          sendMockExtensionMessage({ command: "openAutofillInlineMenu" }, sender);
          await flushPromises();

          expect(tabsSendMessageSpy).toHaveBeenCalledWith(
            sender.tab,
            {
              command: "appendAutofillInlineMenuToDom",
              overlayElement: AutofillOverlayElement.Button,
            },
            topFrameSendOptions,
          );
          expect(tabsSendMessageSpy).toHaveBeenCalledWith(
            sender.tab,
            {
              command: "appendAutofillInlineMenuToDom",
              overlayElement: AutofillOverlayElement.List,
            },
            topFrameSendOptions,
          );
        });

        it("closes the list if the user has the inline menu set to show on button click and the list is open", async () => {
          overlayBackground["inlineMenuListPort"] = listPortSpy;
          inlineMenuVisibilityMock$.next(AutofillOverlayVisibility.OnButtonClick);

          sendMockExtensionMessage({ command: "openAutofillInlineMenu" }, sender);
          await flushPromises();

          expect(tabsSendMessageSpy).toHaveBeenCalledWith(
            sender.tab,
            { command: "closeAutofillInlineMenu", overlayElement: AutofillOverlayElement.List },
            topFrameSendOptions,
          );
        });

        it("updates the position of the button if the user has the inline menu set to show on button click", async () => {
          inlineMenuVisibilityMock$.next(AutofillOverlayVisibility.OnButtonClick);

          sendMockExtensionMessage({ command: "openAutofillInlineMenu" }, sender);
          await flushPromises();

          expect(tabsSendMessageSpy).toHaveBeenCalledWith(
            sender.tab,
            {
              command: "appendAutofillInlineMenuToDom",
              overlayElement: AutofillOverlayElement.Button,
            },
            topFrameSendOptions,
          );
          expect(tabsSendMessageSpy).not.toHaveBeenCalledWith(
            sender.tab,
            {
              command: "appendAutofillInlineMenuToDom",
              overlayElement: AutofillOverlayElement.List,
            },
            topFrameSendOptions,
          );
        });
      });

      describe("when the focused field has a value", () => {
        beforeEach(() => {
          overlayBackground["inlineMenuCiphers"] = new Map([
            ["inline-menu-cipher-1", mock<CipherView>({ id: "inline-menu-cipher-1" })],
          ]);
          jest.spyOn(overlayBackground as any, "checkFocusedFieldHasValue").mockResolvedValue(true);
        });

        it("updates the position of both button and list elements if the inline menu is showing the save login view", async () => {
          overlayBackground["inlineMenuCiphers"] = new Map([]);
          const formData = {
            uri: "https://example.com",
            username: "username",
            password: "password",
            newPassword: "newPassword",
          };
          tabsSendMessageSpy.mockImplementation((_tab, message) => {
            if (message.command === "getInlineMenuFormFieldData") {
              return Promise.resolve(formData);
            }

            return Promise.resolve();
          });

          sendMockExtensionMessage({ command: "openAutofillInlineMenu" }, sender);
          await flushPromises();

          expect(tabsSendMessageSpy).toHaveBeenCalledWith(
            sender.tab,
            {
              command: "appendAutofillInlineMenuToDom",
              overlayElement: AutofillOverlayElement.Button,
            },
            topFrameSendOptions,
          );
          expect(tabsSendMessageSpy).toHaveBeenCalledWith(
            sender.tab,
            {
              command: "appendAutofillInlineMenuToDom",
              overlayElement: AutofillOverlayElement.List,
            },
            topFrameSendOptions,
          );
        });

        it("closes the inline menu list if it is visible", async () => {
          overlayBackground["isInlineMenuListVisible"] = true;

          sendMockExtensionMessage({ command: "openAutofillInlineMenu" }, sender);
          await flushPromises();

          expect(tabsSendMessageSpy).toHaveBeenCalledWith(
            sender.tab,
            { command: "closeAutofillInlineMenu", overlayElement: AutofillOverlayElement.List },
            topFrameSendOptions,
          );
        });

        it("updates the position of the inline menu button", async () => {
          sendMockExtensionMessage({ command: "openAutofillInlineMenu" }, sender);
          await flushPromises();

          expect(tabsSendMessageSpy).toHaveBeenCalledWith(
            sender.tab,
            {
              command: "appendAutofillInlineMenuToDom",
              overlayElement: AutofillOverlayElement.Button,
            },
            topFrameSendOptions,
          );
          expect(tabsSendMessageSpy).not.toHaveBeenCalledWith(
            sender.tab,
            {
              command: "appendAutofillInlineMenuToDom",
              overlayElement: AutofillOverlayElement.List,
            },
            topFrameSendOptions,
          );
        });
      });
    });

    describe("closeAutofillInlineMenu", () => {
      let sender: chrome.runtime.MessageSender;

      beforeEach(() => {
        sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });
        sendMockExtensionMessage({
          command: "updateIsFieldCurrentlyFilling",
          isFieldCurrentlyFilling: false,
        });
        sendMockExtensionMessage({
          command: "updateIsFieldCurrentlyFocused",
          isFieldCurrentlyFocused: false,
        });
      });

      it("sends a message to close the inline menu without checking field focus state if forcing the closure", async () => {
        sendMockExtensionMessage({
          command: "updateIsFieldCurrentlyFocused",
          isFieldCurrentlyFocused: true,
        });
        await flushPromises();

        sendMockExtensionMessage(
          {
            command: "closeAutofillInlineMenu",
            forceCloseInlineMenu: true,
            overlayElement: AutofillOverlayElement.Button,
          },
          sender,
        );
        await flushPromises();

        expect(tabsSendMessageSpy).toHaveBeenCalledWith(
          sender.tab,
          {
            command: "closeAutofillInlineMenu",
            overlayElement: AutofillOverlayElement.Button,
          },
          { frameId: 0 },
        );
      });

      it("skips sending a message to close the inline menu if a form field is currently focused", async () => {
        sendMockExtensionMessage({
          command: "updateIsFieldCurrentlyFocused",
          isFieldCurrentlyFocused: true,
        });
        await flushPromises();

        sendMockExtensionMessage(
          {
            command: "closeAutofillInlineMenu",
            forceCloseInlineMenu: false,
            overlayElement: AutofillOverlayElement.Button,
          },
          sender,
        );
        await flushPromises();

        expect(tabsSendMessageSpy).not.toHaveBeenCalled();
      });

      it("sends a message to close the inline menu list only if the field is currently filling", async () => {
        sendMockExtensionMessage({
          command: "updateIsFieldCurrentlyFilling",
          isFieldCurrentlyFilling: true,
        });
        await flushPromises();

        sendMockExtensionMessage({ command: "closeAutofillInlineMenu" }, sender);
        await flushPromises();

        expect(tabsSendMessageSpy).toHaveBeenCalledWith(
          sender.tab,
          {
            command: "closeAutofillInlineMenu",
            overlayElement: AutofillOverlayElement.List,
          },
          { frameId: 0 },
        );
        expect(tabsSendMessageSpy).not.toHaveBeenCalledWith(
          sender.tab,
          {
            command: "closeAutofillInlineMenu",
            overlayElement: AutofillOverlayElement.Button,
          },
          { frameId: 0 },
        );
      });

      it("sends a message to close the inline menu if the form field is not focused and not filling", async () => {
        overlayBackground["isInlineMenuButtonVisible"] = true;
        overlayBackground["isInlineMenuListVisible"] = true;

        sendMockExtensionMessage({ command: "closeAutofillInlineMenu" }, sender);
        await flushPromises();

        expect(tabsSendMessageSpy).toHaveBeenCalledWith(
          sender.tab,
          {
            command: "closeAutofillInlineMenu",
            overlayElement: undefined,
          },
          { frameId: 0 },
        );
        expect(overlayBackground["isInlineMenuButtonVisible"]).toBe(false);
        expect(overlayBackground["isInlineMenuListVisible"]).toBe(false);
      });

      it("sets a property indicating that the inline menu button is not visible", async () => {
        overlayBackground["isInlineMenuButtonVisible"] = true;

        sendMockExtensionMessage(
          { command: "closeAutofillInlineMenu", overlayElement: AutofillOverlayElement.Button },
          sender,
        );
        await flushPromises();

        expect(overlayBackground["isInlineMenuButtonVisible"]).toBe(false);
      });

      it("sets a property indicating that the inline menu list is not visible", async () => {
        overlayBackground["isInlineMenuListVisible"] = true;

        sendMockExtensionMessage(
          { command: "closeAutofillInlineMenu", overlayElement: AutofillOverlayElement.List },
          sender,
        );
        await flushPromises();

        expect(overlayBackground["isInlineMenuListVisible"]).toBe(false);
      });
    });

    describe("checkAutofillInlineMenuFocused message handler", () => {
      beforeEach(async () => {
        await initOverlayElementPorts();
      });

      it("skips checking if the inline menu is focused if the sender does not contain the focused field", async () => {
        const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });
        const focusedFieldData = createFocusedFieldDataMock();
        sendMockExtensionMessage({ command: "updateFocusedFieldData", focusedFieldData });

        sendMockExtensionMessage({ command: "checkAutofillInlineMenuFocused" }, sender);

        expect(listPortSpy.postMessage).not.toHaveBeenCalledWith({
          command: "checkAutofillInlineMenuListFocused",
        });
        expect(buttonPortSpy.postMessage).not.toHaveBeenCalledWith({
          command: "checkAutofillInlineMenuButtonFocused",
        });
      });

      it("will check if the inline menu list is focused if the list port is open", () => {
        sendMockExtensionMessage({ command: "checkAutofillInlineMenuFocused" });

        expect(listPortSpy.postMessage).toHaveBeenCalledWith({
          command: "checkAutofillInlineMenuListFocused",
        });
        expect(buttonPortSpy.postMessage).not.toHaveBeenCalledWith({
          command: "checkAutofillInlineMenuButtonFocused",
        });
      });

      it("will check if the overlay button is focused if the list port is not open", () => {
        overlayBackground["inlineMenuListPort"] = undefined;

        sendMockExtensionMessage({ command: "checkAutofillInlineMenuFocused" });

        expect(buttonPortSpy.postMessage).toHaveBeenCalledWith({
          command: "checkAutofillInlineMenuButtonFocused",
        });
        expect(listPortSpy.postMessage).not.toHaveBeenCalledWith({
          command: "checkAutofillInlineMenuListFocused",
        });
      });
    });

    describe("focusAutofillInlineMenuList message handler", () => {
      it("will send a `focusInlineMenuList` message to the overlay list port", async () => {
        await initOverlayElementPorts({ initList: true, initButton: false });

        sendMockExtensionMessage({ command: "focusAutofillInlineMenuList" });

        expect(listPortSpy.postMessage).toHaveBeenCalledWith({
          command: "focusAutofillInlineMenuList",
        });
      });
    });

    describe("getAutofillInlineMenuPosition", () => {
      it("returns the current inline menu positio", async () => {
        const inlineMenuPosition: InlineMenuPosition = mock<InlineMenuPosition>();
        overlayBackground["inlineMenuPosition"] = inlineMenuPosition;

        sendMockExtensionMessage(
          { command: "getAutofillInlineMenuPosition" },
          mock<chrome.runtime.MessageSender>(),
          sendResponse,
        );
        await flushPromises();

        expect(sendResponse).toHaveBeenCalledWith(inlineMenuPosition);
      });
    });

    describe("updateAutofillInlineMenuElementIsVisibleStatus message handler", () => {
      let sender: chrome.runtime.MessageSender;
      let focusedFieldData: FocusedFieldData;

      beforeEach(() => {
        sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });
        focusedFieldData = createFocusedFieldDataMock();
        overlayBackground["isInlineMenuButtonVisible"] = true;
        overlayBackground["isInlineMenuListVisible"] = false;
      });

      it("skips updating the inline menu visibility status if the sender tab does not contain the focused field", async () => {
        const otherSender = mock<chrome.runtime.MessageSender>({ tab: { id: 2 } });
        sendMockExtensionMessage(
          { command: "updateFocusedFieldData", focusedFieldData },
          otherSender,
        );

        sendMockExtensionMessage(
          {
            command: "updateAutofillInlineMenuElementIsVisibleStatus",
            overlayElement: AutofillOverlayElement.Button,
            isVisible: false,
          },
          sender,
        );

        expect(overlayBackground["isInlineMenuButtonVisible"]).toBe(true);
        expect(overlayBackground["isInlineMenuListVisible"]).toBe(false);
      });

      it("updates the visibility status of the inline menu button", async () => {
        sendMockExtensionMessage({ command: "updateFocusedFieldData", focusedFieldData }, sender);

        sendMockExtensionMessage(
          {
            command: "updateAutofillInlineMenuElementIsVisibleStatus",
            overlayElement: AutofillOverlayElement.Button,
            isVisible: false,
          },
          sender,
        );

        expect(overlayBackground["isInlineMenuButtonVisible"]).toBe(false);
        expect(overlayBackground["isInlineMenuListVisible"]).toBe(false);
      });

      it("updates the visibility status of the inline menu list", async () => {
        sendMockExtensionMessage({ command: "updateFocusedFieldData", focusedFieldData }, sender);

        sendMockExtensionMessage(
          {
            command: "updateAutofillInlineMenuElementIsVisibleStatus",
            overlayElement: AutofillOverlayElement.List,
            isVisible: true,
          },
          sender,
        );

        expect(overlayBackground["isInlineMenuButtonVisible"]).toBe(true);
        expect(overlayBackground["isInlineMenuListVisible"]).toBe(true);
      });
    });

    describe("checkIsAutofillInlineMenuButtonVisible message handler", () => {
      it("returns true when the inline menu button is visible", async () => {
        overlayBackground["isInlineMenuButtonVisible"] = true;
        const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });

        sendMockExtensionMessage(
          { command: "checkIsAutofillInlineMenuButtonVisible" },
          sender,
          sendResponse,
        );
        await flushPromises();

        expect(sendResponse).toHaveBeenCalledWith(true);
      });
    });

    describe("checkIsAutofillInlineMenuListVisible message handler", () => {
      it("returns true when the inline menu list is visible", async () => {
        overlayBackground["isInlineMenuListVisible"] = true;
        const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });

        sendMockExtensionMessage(
          { command: "checkIsAutofillInlineMenuListVisible" },
          sender,
          sendResponse,
        );
        await flushPromises();

        expect(sendResponse).toHaveBeenCalledWith(true);
      });
    });

    describe("getCurrentTabFrameId message handler", () => {
      it("returns the sender's frame id", async () => {
        const sender = mock<chrome.runtime.MessageSender>({ frameId: 1 });

        sendMockExtensionMessage({ command: "getCurrentTabFrameId" }, sender, sendResponse);
        await flushPromises();

        expect(sendResponse).toHaveBeenCalledWith(1);
      });
    });

    describe("destroyAutofillInlineMenuListeners", () => {
      it("sends a message to the passed frameId that triggers a destruction of the inline menu listeners on that frame", () => {
        const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 }, frameId: 0 });

        sendMockExtensionMessage(
          { command: "destroyAutofillInlineMenuListeners", subFrameData: { frameId: 10 } },
          sender,
        );

        expect(tabsSendMessageSpy).toHaveBeenCalledWith(
          sender.tab,
          { command: "destroyAutofillInlineMenuListeners" },
          { frameId: 10 },
        );
      });
    });

    describe("unlockCompleted", () => {
      beforeEach(async () => {
        jest.spyOn(overlayBackground, "updateOverlayCiphers");
        await initOverlayElementPorts();
      });

      it("updates the inline menu button auth status", async () => {
        sendMockExtensionMessage({ command: "unlockCompleted" });
        await flushPromises();

        expect(buttonPortSpy.postMessage).toHaveBeenCalledWith({
          command: "updateInlineMenuButtonAuthStatus",
          authStatus: AuthenticationStatus.Unlocked,
        });
      });

      it("updates the overlay ciphers", async () => {
        const updateInlineMenuCiphersSpy = jest.spyOn(overlayBackground, "updateOverlayCiphers");
        sendMockExtensionMessage({ command: "unlockCompleted" });
        await flushPromises();

        expect(updateInlineMenuCiphersSpy).toHaveBeenCalled();
      });

      it("focuses the most recently focused field if a retry command is present in the message", async () => {
        activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
        getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(createChromeTabMock({ id: 1 }));
        sendMockExtensionMessage({
          command: "unlockCompleted",
          data: {
            commandToRetry: { message: { command: "openAutofillInlineMenu" } },
          },
        });
        await flushPromises();

        expect(tabsSendMessageSpy).toHaveBeenCalledWith(expect.any(Object), {
          command: "focusMostRecentlyFocusedField",
        });
      });
    });

    describe("extension messages that trigger an update of the inline menu ciphers", () => {
      const extensionMessages = [
        "doFullSync",
        "addedCipher",
        "addEditCipherSubmitted",
        "editedCipher",
        "deletedCipher",
      ];

      beforeEach(() => {
        jest.spyOn(overlayBackground, "updateOverlayCiphers").mockImplementation();
      });

      extensionMessages.forEach((message) => {
        it(`triggers an update of the overlay ciphers when the ${message} message is received`, () => {
          sendMockExtensionMessage({ command: message });
          expect(overlayBackground.updateOverlayCiphers).toHaveBeenCalled();
        });
      });
    });

    describe("fido2AbortRequest", () => {
      const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });
      it("removes an active request associated with the sender tab", () => {
        const removeActiveRequestSpy = jest.spyOn(fido2ActiveRequestManager, "removeActiveRequest");

        sendMockExtensionMessage({ command: "fido2AbortRequest" }, sender);

        expect(removeActiveRequestSpy).toHaveBeenCalledWith(sender.tab.id);
      });

      it("updates the overlay ciphers after removing the active request", () => {
        const updateOverlayCiphersSpy = jest.spyOn(overlayBackground, "updateOverlayCiphers");

        sendMockExtensionMessage({ command: "fido2AbortRequest" }, sender);

        expect(updateOverlayCiphersSpy).toHaveBeenCalledWith(false);
      });
    });
  });

  describe("handle extension onMessage", () => {
    it("will return early if the message command is not present within the extensionMessageHandlers", () => {
      const message = {
        command: "not-a-command",
      };
      const sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });
      const sendResponse = jest.fn();

      const returnValue = overlayBackground["handleExtensionMessage"](
        message,
        sender,
        sendResponse,
      );

      expect(returnValue).toBe(null);
      expect(sendResponse).not.toHaveBeenCalled();
    });
  });

  describe("inline menu button message handlers", () => {
    let sender: chrome.runtime.MessageSender;
    const portKey = "inlineMenuButtonPort";

    beforeEach(async () => {
      sender = mock<chrome.runtime.MessageSender>({ tab: createChromeTabMock({ id: 1 }) });
      portKeyForTabSpy[sender.tab.id] = portKey;
      activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
      await initOverlayElementPorts();
      buttonMessageConnectorSpy.sender = sender;
      openUnlockPopoutSpy.mockImplementation();
    });

    describe("autofillInlineMenuButtonClicked message handler", () => {
      it("opens the unlock vault popout if the user auth status is not unlocked", async () => {
        activeAccountStatusMock$.next(AuthenticationStatus.Locked);

        sendPortMessage(buttonMessageConnectorSpy, {
          command: "autofillInlineMenuButtonClicked",
          portKey,
        });
        await flushPromises();

        expect(tabsSendMessageSpy).toHaveBeenCalledWith(
          sender.tab,
          { command: "closeAutofillInlineMenu", overlayElement: undefined },
          { frameId: 0 },
        );
        expect(tabSendMessageDataSpy).toBeCalledWith(
          sender.tab,
          "addToLockedVaultPendingNotifications",
          {
            commandToRetry: { message: { command: "openAutofillInlineMenu" }, sender },
            target: "overlay.background",
          },
        );
        expect(openUnlockPopoutSpy).toHaveBeenCalled();
      });

      it("opens the inline menu if the user auth status is unlocked", async () => {
        getTabFromCurrentWindowIdSpy.mockResolvedValueOnce(sender.tab);
        sendMockExtensionMessage(
          {
            command: "updateFocusedFieldData",
            focusedFieldData: mock<FocusedFieldData>(),
          },
          mock<chrome.runtime.MessageSender>({ tab: buttonMessageConnectorSpy.sender.tab }),
        );
        jest
          .spyOn(overlayBackground as any, "getInlineMenuButtonPosition")
          .mockReturnValueOnce({ x: 0, y: 0 });
        sendPortMessage(buttonMessageConnectorSpy, {
          command: "autofillInlineMenuButtonClicked",
          portKey,
        });
        await flushPromises();

        expect(tabsSendMessageSpy).toHaveBeenCalledWith(
          sender.tab,
          {
            command: "appendAutofillInlineMenuToDom",
            overlayElement: AutofillOverlayElement.List,
          },
          { frameId: 0 },
        );
      });
    });
    describe("handles menu position when input is focused", () => {
      it("sets button and menu width and position when non-multi-input totp field is focused", async () => {
        const subframe = {
          top: 0,
          left: 0,
          url: "",
          frameId: 0,
        };

        overlayBackground["focusedFieldData"] = createFocusedFieldDataMock({
          focusedFieldRects: {
            width: 49.328125,
            height: 64,
            top: 302.171875,
            left: 1270.8125,
          },
        });

        const buttonPostion = overlayBackground["getInlineMenuButtonPosition"](subframe);
        const menuPostion = overlayBackground["getInlineMenuListPosition"](subframe);

        expect(menuPostion).toEqual({
          width: "49px",
          top: "366px",
          left: "1271px",
        });
        expect(buttonPostion).toEqual({
          width: "34px",
          height: "34px",
          top: "317px",
          left: "1271px",
        });
      });
      it("sets button and menu width and position when multi-input totp field is focused", async () => {
        const subframe = {
          top: 0,
          left: 0,
          url: "",
          frameId: 0,
        };

        const totpFields = [
          createAutofillFieldMock({ autoCompleteType: "one-time-code", opid: "__0" }),
          createAutofillFieldMock({ autoCompleteType: "one-time-code", opid: "__1" }),
          createAutofillFieldMock({ autoCompleteType: "one-time-code", opid: "__2" }),
        ];
        const allFieldData = [
          createAutofillFieldMock({
            autoCompleteType: "one-time-code",
            opid: "__0",
            rect: {
              x: 1041.5,
              y: 302.171875,
              width: 49.328125,
              height: 64,
              top: 302.171875,
              right: 1090.828125,
              bottom: 366.171875,
              left: 1041.5,
            },
          }),
          createAutofillFieldMock({
            autoCompleteType: "one-time-code",
            opid: "__1",
            rect: {
              x: 1098.828125,
              y: 302.171875,
              width: 49.328125,
              height: 64,
              top: 302.171875,
              right: 1148.15625,
              bottom: 366.171875,
              left: 1098.828125,
            },
          }),
          createAutofillFieldMock({
            autoCompleteType: "one-time-code",
            opid: "__2",
            rect: {
              x: 1156.15625,
              y: 302.171875,
              width: 249.328125,
              height: 64,
              top: 302.171875,
              right: 2205.484375,
              bottom: 366.171875,
              left: 2156.15625,
            },
          }),
        ];
        overlayBackground["focusedFieldData"] = createFocusedFieldDataMock({
          focusedFieldRects: {
            width: 49.328125,
            height: 64,
            top: 302.171875,
            left: 1270.8125,
          },
        });

        overlayBackground["allFieldData"] = allFieldData;
        jest.spyOn(overlayBackground as any, "isTotpFieldForCurrentField").mockReturnValue(true);
        jest.spyOn(overlayBackground as any, "getTotpFields").mockReturnValue(totpFields);

        const buttonPostion = overlayBackground["getInlineMenuButtonPosition"](subframe);
        const menuPostion = overlayBackground["getInlineMenuListPosition"](subframe);
        expect(menuPostion).toEqual({
          width: "1164px",
          top: "366px",
          left: "1042px",
        });
        expect(buttonPostion).toEqual({
          width: "34px",
          height: "34px",
          top: "292px",
          left: "2187px",
        });
      });
    });

    describe("triggerDelayedAutofillInlineMenuClosure message handler", () => {
      it("skips triggering the delayed closure of the inline menu if a field is currently focused", async () => {
        jest.useFakeTimers();
        sendMockExtensionMessage({
          command: "updateIsFieldCurrentlyFocused",
          isFieldCurrentlyFocused: true,
        });
        await flushPromises();

        sendPortMessage(buttonMessageConnectorSpy, {
          command: "triggerDelayedAutofillInlineMenuClosure",
          portKey,
        });
        await flushPromises();
        jest.advanceTimersByTime(100);

        const message = { command: "triggerDelayedAutofillInlineMenuClosure" };
        expect(buttonPortSpy.postMessage).not.toHaveBeenCalledWith(message);
        expect(listPortSpy.postMessage).not.toHaveBeenCalledWith(message);
      });

      it("sends a message to the button and list ports that triggers a delayed closure of the inline menu", async () => {
        jest.useFakeTimers();
        sendPortMessage(buttonMessageConnectorSpy, {
          command: "triggerDelayedAutofillInlineMenuClosure",
          portKey,
        });
        await flushPromises();
        jest.advanceTimersByTime(100);

        const message = { command: "triggerDelayedAutofillInlineMenuClosure" };
        expect(buttonPortSpy.postMessage).toHaveBeenCalledWith(message);
        expect(listPortSpy.postMessage).toHaveBeenCalledWith(message);
      });

      it("triggers a single delayed closure if called again within a 100ms threshold", async () => {
        jest.useFakeTimers();
        sendPortMessage(buttonMessageConnectorSpy, {
          command: "triggerDelayedAutofillInlineMenuClosure",
          portKey,
        });
        await flushPromises();
        jest.advanceTimersByTime(50);
        sendPortMessage(buttonMessageConnectorSpy, {
          command: "triggerDelayedAutofillInlineMenuClosure",
          portKey,
        });
        await flushPromises();
        jest.advanceTimersByTime(100);

        const message = { command: "triggerDelayedAutofillInlineMenuClosure" };
        expect(buttonPortSpy.postMessage).toHaveBeenCalledTimes(2);
        expect(buttonPortSpy.postMessage).not.toHaveBeenNthCalledWith(1, message);
        expect(buttonPortSpy.postMessage).toHaveBeenNthCalledWith(2, message);
        expect(listPortSpy.postMessage).toHaveBeenCalledTimes(2);
        expect(listPortSpy.postMessage).not.toHaveBeenNthCalledWith(1, message);
        expect(listPortSpy.postMessage).toHaveBeenNthCalledWith(2, message);
      });
    });

    describe("autofillInlineMenuBlurred message handler", () => {
      it("sends a message to the inline menu list to check if the element is focused", async () => {
        sendPortMessage(buttonMessageConnectorSpy, {
          command: "autofillInlineMenuBlurred",
          portKey,
        });
        await flushPromises();

        expect(listPortSpy.postMessage).toHaveBeenCalledWith({
          command: "checkAutofillInlineMenuListFocused",
        });
      });
    });

    describe("redirectAutofillInlineMenuFocusOut message handler", () => {
      it("ignores the redirect message if the direction is not provided", () => {
        sendPortMessage(buttonMessageConnectorSpy, {
          command: "redirectAutofillInlineMenuFocusOut",
          portKey,
        });

        expect(tabSendMessageDataSpy).not.toHaveBeenCalled();
      });

      it("sends the redirect message if the direction is provided", () => {
        sendPortMessage(buttonMessageConnectorSpy, {
          command: "redirectAutofillInlineMenuFocusOut",
          direction: RedirectFocusDirection.Next,
          portKey,
        });

        expect(tabSendMessageDataSpy).toHaveBeenCalledWith(
          sender.tab,
          "redirectAutofillInlineMenuFocusOut",
          { direction: RedirectFocusDirection.Next },
        );
      });
    });

    describe("updateAutofillInlineMenuColorScheme message handler", () => {
      it("sends a message to the button port to update the inline menu color scheme", async () => {
        sendPortMessage(buttonMessageConnectorSpy, {
          command: "updateAutofillInlineMenuColorScheme",
          portKey,
        });
        await flushPromises();

        expect(buttonPortSpy.postMessage).toHaveBeenCalledWith({
          command: "updateAutofillInlineMenuColorScheme",
        });
      });
    });
  });

  describe("inline menu list message handlers", () => {
    let sender: chrome.runtime.MessageSender;
    const portKey = "inlineMenuListPort";

    beforeEach(async () => {
      sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });
      portKeyForTabSpy[sender.tab.id] = portKey;
      activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
      await initOverlayElementPorts();
      listMessageConnectorSpy.sender = sender;
      openUnlockPopoutSpy.mockImplementation();
    });

    describe("checkAutofillInlineMenuButtonFocused message handler", () => {
      it("sends a message to the inline menu button to check if the element is focused", async () => {
        sendPortMessage(listMessageConnectorSpy, {
          command: "checkAutofillInlineMenuButtonFocused",
          portKey,
        });

        expect(buttonPortSpy.postMessage).toHaveBeenCalledWith({
          command: "checkAutofillInlineMenuButtonFocused",
        });
      });
    });

    describe("autofillInlineMenuBlurred message handler", () => {
      it("sends a message to the inline menu button to check if the element is focused", async () => {
        sendPortMessage(listMessageConnectorSpy, {
          command: "autofillInlineMenuBlurred",
          portKey,
        });

        expect(buttonPortSpy.postMessage).toHaveBeenCalledWith({
          command: "checkAutofillInlineMenuButtonFocused",
        });
      });
    });

    describe("unlockVault message handler", () => {
      it("opens the unlock vault popout", async () => {
        activeAccountStatusMock$.next(AuthenticationStatus.Locked);

        sendPortMessage(listMessageConnectorSpy, { command: "unlockVault", portKey });
        await flushPromises();

        expect(openUnlockPopoutSpy).toHaveBeenCalled();
      });
    });

    describe("fillAutofillInlineMenuCipher message handler", () => {
      const pageDetails = createAutofillPageDetailsMock({
        login: { username: "username1", password: "password1" },
      });

      it("ignores the fill request if the overlay cipher id is not provided", async () => {
        sendPortMessage(listMessageConnectorSpy, {
          command: "fillAutofillInlineMenuCipher",
          portKey,
        });
        await flushPromises();

        expect(autofillService.isPasswordRepromptRequired).not.toHaveBeenCalled();
        expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      });

      it("ignores the fill request if the tab does not contain any identified page details", async () => {
        sendPortMessage(listMessageConnectorSpy, {
          command: "fillAutofillInlineMenuCipher",
          inlineMenuCipherId: "inline-menu-cipher-1",
          portKey,
        });
        await flushPromises();

        expect(autofillService.isPasswordRepromptRequired).not.toHaveBeenCalled();
        expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      });

      it("ignores the fill request if a master password reprompt is required", async () => {
        const cipher = mock<CipherView>({
          reprompt: CipherRepromptType.Password,
          type: CipherType.Login,
        });
        overlayBackground["inlineMenuCiphers"] = new Map([["inline-menu-cipher-1", cipher]]);
        overlayBackground["pageDetailsForTab"][sender.tab.id] = new Map([
          [sender.frameId, { frameId: sender.frameId, tab: sender.tab, details: pageDetails }],
        ]);
        autofillService.isPasswordRepromptRequired.mockResolvedValue(true);

        sendPortMessage(listMessageConnectorSpy, {
          command: "fillAutofillInlineMenuCipher",
          inlineMenuCipherId: "inline-menu-cipher-1",
          portKey,
        });
        await flushPromises();

        expect(autofillService.isPasswordRepromptRequired).toHaveBeenCalledWith(cipher, sender.tab);
        expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      });

      it("autofills the selected cipher and moves it to the top of the front of the ciphers map", async () => {
        const cipher1 = mock<CipherView>({ id: "inline-menu-cipher-1" });
        const cipher2 = mock<CipherView>({ id: "inline-menu-cipher-2" });
        const cipher3 = mock<CipherView>({ id: "inline-menu-cipher-3" });
        overlayBackground["inlineMenuCiphers"] = new Map([
          ["inline-menu-cipher-1", cipher1],
          ["inline-menu-cipher-2", cipher2],
          ["inline-menu-cipher-3", cipher3],
        ]);
        const pageDetailsForTab = {
          frameId: sender.frameId,
          tab: sender.tab,
          details: pageDetails,
        };
        overlayBackground["pageDetailsForTab"][sender.tab.id] = new Map([
          [sender.frameId, pageDetailsForTab],
        ]);
        autofillService.isPasswordRepromptRequired.mockResolvedValue(false);

        sendPortMessage(listMessageConnectorSpy, {
          command: "fillAutofillInlineMenuCipher",
          inlineMenuCipherId: "inline-menu-cipher-2",
          portKey,
        });
        await flushPromises();

        expect(autofillService.isPasswordRepromptRequired).toHaveBeenCalledWith(
          cipher2,
          sender.tab,
        );
        expect(autofillService.doAutoFill).toHaveBeenCalledWith({
          tab: sender.tab,
          cipher: cipher2,
          pageDetails: [pageDetailsForTab],
          fillNewPassword: true,
          allowTotpAutofill: true,
        });
        expect(overlayBackground["inlineMenuCiphers"].entries()).toStrictEqual(
          new Map([
            ["inline-menu-cipher-2", cipher2],
            ["inline-menu-cipher-1", cipher1],
            ["inline-menu-cipher-3", cipher3],
          ]).entries(),
        );
      });

      it("copies the cipher's totp code to the clipboard after filling", async () => {
        const cipher1 = mock<CipherView>({ id: "inline-menu-cipher-1" });
        overlayBackground["inlineMenuCiphers"] = new Map([["inline-menu-cipher-1", cipher1]]);
        overlayBackground["pageDetailsForTab"][sender.tab.id] = new Map([
          [sender.frameId, { frameId: sender.frameId, tab: sender.tab, details: pageDetails }],
        ]);
        autofillService.isPasswordRepromptRequired.mockResolvedValue(false);
        const copyToClipboardSpy = jest
          .spyOn(overlayBackground["platformUtilsService"], "copyToClipboard")
          .mockImplementation();
        autofillService.doAutoFill.mockResolvedValue("totp-code");

        sendPortMessage(listMessageConnectorSpy, {
          command: "fillAutofillInlineMenuCipher",
          inlineMenuCipherId: "inline-menu-cipher-2",
          portKey,
        });
        await flushPromises();

        expect(copyToClipboardSpy).toHaveBeenCalledWith("totp-code");
      });

      describe("triggering passkey authentication", () => {
        let cipher1: CipherView;

        beforeEach(() => {
          const fido2Credential = mock<Fido2CredentialView>({ credentialId: "credential-id" });
          cipher1 = mock<CipherView>({
            id: "inline-menu-cipher-1",
            login: {
              username: "username1",
              password: "password1",
              fido2Credentials: [fido2Credential],
            },
          });
          const pageDetailsForTab = {
            frameId: sender.frameId,
            tab: sender.tab,
            details: pageDetails,
          };
          overlayBackground["inlineMenuCiphers"] = new Map([["inline-menu-cipher-1", cipher1]]);
          overlayBackground["pageDetailsForTab"][sender.tab.id] = new Map([
            [sender.frameId, pageDetailsForTab],
          ]);
          autofillService.isPasswordRepromptRequired.mockResolvedValue(false);
        });

        it("logs an error if the authentication could not complete due to a missing FIDO2 request", async () => {
          jest.spyOn(logService, "error");

          sendPortMessage(listMessageConnectorSpy, {
            command: "fillAutofillInlineMenuCipher",
            inlineMenuCipherId: "inline-menu-cipher-1",
            usePasskey: true,
            portKey,
          });
          await flushPromises();

          expect(logService.error).toHaveBeenCalled();
        });

        describe("when the FIDO2 request is present", () => {
          beforeEach(async () => {
            void fido2ActiveRequestManager.newActiveRequest(
              sender.tab.id,
              cipher1.login.fido2Credentials,
              new AbortController(),
            );
          });

          it("aborts all active FIDO2 requests if the subsequent request after the authentication is invalid", async () => {
            jest.spyOn(fido2ActiveRequestManager, "removeActiveRequest");

            sendPortMessage(listMessageConnectorSpy, {
              command: "fillAutofillInlineMenuCipher",
              inlineMenuCipherId: "inline-menu-cipher-1",
              usePasskey: true,
              portKey,
            });
            await flushPromises();
            triggerWebRequestOnCompletedEvent(
              mock<chrome.webRequest.OnCompletedDetails>({
                statusCode: 401,
              }),
            );

            expect(fido2ActiveRequestManager.removeActiveRequest).toHaveBeenCalled();
          });

          it("triggers a closure of the inline menu if the subsequent request after the authentication is valid", async () => {
            jest.useFakeTimers();

            await initOverlayElementPorts();
            sendPortMessage(listMessageConnectorSpy, {
              command: "fillAutofillInlineMenuCipher",
              inlineMenuCipherId: "inline-menu-cipher-1",
              usePasskey: true,
              portKey,
            });
            await flushPromises();
            triggerWebRequestOnCompletedEvent(
              mock<chrome.webRequest.OnCompletedDetails>({
                statusCode: 200,
              }),
            );
            jest.advanceTimersByTime(3100);

            expect(listPortSpy.postMessage).toHaveBeenCalledWith({
              command: "triggerDelayedAutofillInlineMenuClosure",
            });
          });
        });
      });

      it("fills the current password fields exclusively when filling for a current password update", async () => {
        globalThis.structuredClone = jest.fn((value) => value);
        sendMockExtensionMessage(
          {
            command: "updateFocusedFieldData",
            focusedFieldData: createFocusedFieldDataMock({
              inlineMenuFillType: InlineMenuFillTypes.CurrentPasswordUpdate,
            }),
          },
          sender,
        );
        const currentPasswordField = createAutofillFieldMock({
          autoCompleteType: "current-password",
          title: "Current Password",
          type: "password",
        });
        const newPasswordField = createAutofillFieldMock({
          autoCompleteType: "new-password",
          title: "New Password",
          type: "password",
        });
        const confirmNewPasswordField = createAutofillFieldMock({
          autoCompleteType: "new-password",
          title: "Confirm New Password",
          type: "password",
        });
        const pageDetails = createAutofillPageDetailsMock({
          fields: [currentPasswordField, newPasswordField, confirmNewPasswordField],
        });
        overlayBackground["pageDetailsForTab"][sender.tab.id] = new Map([
          [sender.frameId, { frameId: sender.frameId, tab: sender.tab, details: pageDetails }],
        ]);

        sendPortMessage(listMessageConnectorSpy, {
          command: "fillAutofillInlineMenuCipher",
          inlineMenuCipherId: "inline-menu-cipher-2",
          portKey,
        });
        await flushPromises();

        pageDetails.fields = [currentPasswordField];
        expect(autofillService.doAutoFill).toHaveBeenCalledWith(
          expect.objectContaining({
            pageDetails: [expect.objectContaining({ details: pageDetails })],
          }),
        );
      });
    });

    describe("addNewVaultItem message handler", () => {
      it("skips sending the `addNewVaultItemFromOverlay` message if the sender tab does not contain the focused field", async () => {
        const focusedFieldData = createFocusedFieldDataMock({ tabId: 2 });
        sendMockExtensionMessage({ command: "updateFocusedFieldData", focusedFieldData });
        await flushPromises();

        sendPortMessage(listMessageConnectorSpy, {
          command: "addNewVaultItem",
          portKey,
          addNewCipherType: CipherType.Login,
        });
        await flushPromises();

        expect(tabsSendMessageSpy).not.toHaveBeenCalledWith(sender.tab, {
          command: "addNewVaultItemFromOverlay",
          addNewCipherType: CipherType.Login,
        });
      });

      it("sends a message to the tab to add a new vault item", async () => {
        const focusedFieldData = createFocusedFieldDataMock();
        sendMockExtensionMessage({ command: "updateFocusedFieldData", focusedFieldData }, sender);
        await flushPromises();

        sendPortMessage(listMessageConnectorSpy, {
          command: "addNewVaultItem",
          portKey,
          addNewCipherType: CipherType.Login,
        });
        await flushPromises();

        expect(tabsSendMessageSpy).toHaveBeenCalledWith(sender.tab, {
          command: "addNewVaultItemFromOverlay",
          addNewCipherType: CipherType.Login,
        });
      });
    });

    describe("viewSelectedCipher message handler", () => {
      let openViewVaultItemPopoutSpy: jest.SpyInstance;

      beforeEach(() => {
        openViewVaultItemPopoutSpy = jest
          .spyOn(overlayBackground as any, "openViewVaultItemPopout")
          .mockImplementation();
      });

      it("returns early if the passed cipher ID does not match one of the inline menu ciphers", async () => {
        overlayBackground["inlineMenuCiphers"] = new Map([
          ["inline-menu-cipher-0", mock<CipherView>({ id: "inline-menu-cipher-0" })],
        ]);

        sendPortMessage(listMessageConnectorSpy, {
          command: "viewSelectedCipher",
          inlineMenuCipherId: "inline-menu-cipher-1",
          portKey,
        });
        await flushPromises();

        expect(openViewVaultItemPopoutSpy).not.toHaveBeenCalled();
      });

      it("will open the view vault item popout with the selected cipher", async () => {
        const cipher = mock<CipherView>({ id: "inline-menu-cipher-1" });
        overlayBackground["inlineMenuCiphers"] = new Map([
          ["inline-menu-cipher-0", mock<CipherView>({ id: "inline-menu-cipher-0" })],
          ["inline-menu-cipher-1", cipher],
        ]);

        sendPortMessage(listMessageConnectorSpy, {
          command: "viewSelectedCipher",
          inlineMenuCipherId: "inline-menu-cipher-1",
          portKey,
        });
        await flushPromises();

        expect(openViewVaultItemPopoutSpy).toHaveBeenCalledWith(sender.tab, {
          cipherId: cipher.id,
          action: SHOW_AUTOFILL_BUTTON,
        });
      });
    });

    describe("redirectAutofillInlineMenuFocusOut message handler", () => {
      it("redirects focus out of the inline menu list", async () => {
        sendPortMessage(listMessageConnectorSpy, {
          command: "redirectAutofillInlineMenuFocusOut",
          direction: RedirectFocusDirection.Next,
          portKey,
        });
        await flushPromises();

        expect(tabSendMessageDataSpy).toHaveBeenCalledWith(
          sender.tab,
          "redirectAutofillInlineMenuFocusOut",
          { direction: RedirectFocusDirection.Next },
        );
      });
    });

    describe("updateAutofillInlineMenuListHeight message handler", () => {
      it("sends a message to the list port to update the menu iframe position", () => {
        sendPortMessage(listMessageConnectorSpy, {
          command: "updateAutofillInlineMenuListHeight",
          styles: { height: "100px" },
          portKey,
        });

        expect(listPortSpy.postMessage).toHaveBeenCalledWith({
          command: "updateAutofillInlineMenuPosition",
          styles: { height: "100px" },
        });
      });

      it("updates the inline menu position property's list height value", () => {
        overlayBackground["inlineMenuPosition"] = {
          list: { height: 50, top: 1, left: 2, width: 3 },
        };

        sendPortMessage(listMessageConnectorSpy, {
          command: "updateAutofillInlineMenuListHeight",
          styles: { height: "100px" },
          portKey,
        });

        expect(overlayBackground["inlineMenuPosition"]).toStrictEqual({
          list: { height: 100, top: 1, left: 2, width: 3 },
        });
      });
    });

    describe("refreshGeneratedPassword", () => {
      it("refreshes the generated password", async () => {
        overlayBackground["generatedPassword"] = "populated";

        sendPortMessage(listMessageConnectorSpy, { command: "refreshGeneratedPassword", portKey });
        await flushPromises();

        expect(generatedPasswordCallbackMock).toHaveBeenCalled();
      });

      it("sends a message to the list port indicating that the generated password should be updated", async () => {
        sendPortMessage(listMessageConnectorSpy, { command: "refreshGeneratedPassword", portKey });
        await flushPromises();

        expect(listPortSpy.postMessage).toHaveBeenCalledWith({
          command: "updateAutofillInlineMenuGeneratedPassword",
          generatedPassword,
          refreshPassword: true,
        });
      });
    });

    describe("fillGeneratedPassword", () => {
      const focusedFieldData = createFocusedFieldDataMock({
        inlineMenuFillType: InlineMenuFillTypes.PasswordGeneration,
      });

      beforeEach(() => {
        globalThis.structuredClone = jest.fn((value) => value);
        sendMockExtensionMessage(
          {
            command: "updateFocusedFieldData",
            focusedFieldData,
          },
          sender,
        );
        overlayBackground["generatedPassword"] = generatedPassword;
        overlayBackground["pageDetailsForTab"][sender.tab.id] = new Map([
          [sender.frameId, createPageDetailMock()],
        ]);
      });

      describe("skipping filling the generated password", () => {
        it("skips filling when the password has not been created", () => {
          overlayBackground["generatedPassword"] = "";

          sendPortMessage(listMessageConnectorSpy, { command: "fillGeneratedPassword", portKey });

          expect(autofillService.doAutoFill).not.toHaveBeenCalled();
        });

        it("skips filling when the page details for the tab are not set", () => {
          overlayBackground["pageDetailsForTab"][sender.tab.id] = undefined;

          sendPortMessage(listMessageConnectorSpy, { command: "fillGeneratedPassword", portKey });

          expect(autofillService.doAutoFill).not.toHaveBeenCalled();
        });

        it("skips filling when the page details for the tab does not contain a value", () => {
          overlayBackground["pageDetailsForTab"][sender.tab.id] = new Map([]);

          sendPortMessage(listMessageConnectorSpy, { command: "fillGeneratedPassword", portKey });

          expect(autofillService.doAutoFill).not.toHaveBeenCalled();
        });
      });

      it("sends a message to the tab to store modify login change when a password is generated", async () => {
        jest.useFakeTimers();

        sendPortMessage(listMessageConnectorSpy, { command: "fillGeneratedPassword", portKey });

        await flushPromises();
        jest.advanceTimersByTime(400);
        await flushPromises();

        expect(tabsSendMessageSpy.mock.lastCall[1].command).toBe("generatedPasswordModifyLogin");
      });

      it("filters the page details to only include the new password fields before filling", async () => {
        sendPortMessage(listMessageConnectorSpy, { command: "fillGeneratedPassword", portKey });
        await flushPromises();

        expect(autofillService.doAutoFill).toHaveBeenCalledWith({
          tab: sender.tab,
          cipher: expect.any(Object),
          pageDetails: [overlayBackground["pageDetailsForTab"][sender.tab.id].get(sender.frameId)],
          fillNewPassword: true,
          allowTotpAutofill: false,
          focusedFieldForm: undefined,
          focusedFieldOpid: undefined,
          inlineMenuFillType: InlineMenuFillTypes.PasswordGeneration,
        });
      });
    });
  });

  describe("handle web navigation on committed events", () => {
    describe("navigation event occurs in the top frame of the tab", () => {
      it("removes the collected page details", async () => {
        const sender = mock<chrome.webNavigation.WebNavigationFramedCallbackDetails>({
          tabId: 1,
          frameId: 0,
        });
        overlayBackground["pageDetailsForTab"][sender.tabId] = new Map([
          [sender.frameId, createPageDetailMock()],
        ]);

        triggerWebNavigationOnCommittedEvent(sender);
        await flushPromises();

        expect(overlayBackground["pageDetailsForTab"][sender.tabId]).toBe(undefined);
      });

      it("clears the sub frames associated with the tab", () => {
        const sender = mock<chrome.webNavigation.WebNavigationFramedCallbackDetails>({
          tabId: 1,
          frameId: 0,
        });
        const subFrameId = 10;
        overlayBackground["subFrameOffsetsForTab"][sender.tabId] = new Map([
          [subFrameId, mock<SubFrameOffsetData>()],
        ]);

        triggerWebNavigationOnCommittedEvent(sender);

        expect(overlayBackground["subFrameOffsetsForTab"][sender.tabId]).toBe(undefined);
      });
    });

    describe("navigation event occurs within sub frame", () => {
      it("clears the sub frame offsets for the current frame", () => {
        const sender = mock<chrome.webNavigation.WebNavigationFramedCallbackDetails>({
          tabId: 1,
          frameId: 1,
        });
        overlayBackground["subFrameOffsetsForTab"][sender.tabId] = new Map([
          [sender.frameId, mock<SubFrameOffsetData>()],
        ]);

        triggerWebNavigationOnCommittedEvent(sender);

        expect(overlayBackground["subFrameOffsetsForTab"][sender.tabId].get(sender.frameId)).toBe(
          undefined,
        );
      });
    });
  });

  describe("handle port onConnect", () => {
    it("skips setting up the overlay port if the port connection is not for an overlay element", async () => {
      const port = createPortSpyMock("not-an-overlay-element");

      triggerPortOnConnectEvent(port);
      await flushPromises();

      expect(port.onMessage.addListener).not.toHaveBeenCalled();
      expect(port.postMessage).not.toHaveBeenCalled();
    });

    it("generates a random 12 character string used to validate port messages from the tab", async () => {
      const port = createPortSpyMock(AutofillOverlayPort.Button);
      overlayBackground["inlineMenuButtonPort"] = port;

      triggerPortOnConnectEvent(port);
      await flushPromises();

      expect(portKeyForTabSpy[port.sender.tab.id]).toHaveLength(12);
    });

    it("stores an existing overlay port so that it can be disconnected at a later time", async () => {
      overlayBackground["inlineMenuButtonPort"] = mock<chrome.runtime.Port>();

      await initOverlayElementPorts({ initList: false, initButton: true });
      await flushPromises();

      expect(overlayBackground["expiredPorts"].length).toBe(1);
    });

    it("generates a password for the password generator view", async () => {
      activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
      const focusedFieldData = createFocusedFieldDataMock({
        inlineMenuFillType: CipherType.Login,
        accountCreationFieldType: InlineMenuAccountCreationFieldType.Password,
      });
      sendMockExtensionMessage({ command: "updateFocusedFieldData", focusedFieldData });

      await initOverlayElementPorts();
      await flushPromises();

      expect(generatedPasswordCallbackMock).toHaveBeenCalled();
    });
  });

  describe("handle overlay element port onMessage", () => {
    let sender: chrome.runtime.MessageSender;
    const portKey = "inlineMenuListPort";

    beforeEach(async () => {
      sender = mock<chrome.runtime.MessageSender>({ tab: { id: 1 } });
      portKeyForTabSpy[sender.tab.id] = portKey;
      activeAccountStatusMock$.next(AuthenticationStatus.Unlocked);
      await initOverlayElementPorts();
      listMessageConnectorSpy.sender = sender;
      openUnlockPopoutSpy.mockImplementation();
    });

    it("ignores messages that do not contain a valid portKey", async () => {
      triggerPortOnMessageEvent(buttonMessageConnectorSpy, {
        command: "autofillInlineMenuBlurred",
      });
      await flushPromises();

      expect(listPortSpy.postMessage).not.toHaveBeenCalledWith({
        command: "checkAutofillInlineMenuListFocused",
      });
    });

    it("ignores messages from ports that are not listened to", () => {
      triggerPortOnMessageEvent(buttonPortSpy, {
        command: "autofillInlineMenuBlurred",
        portKey,
      });

      expect(listPortSpy.postMessage).not.toHaveBeenCalledWith({
        command: "checkAutofillInlineMenuListFocused",
      });
    });
  });

  describe("handle port onDisconnect", () => {
    it("sets the disconnected port to a `null` value", async () => {
      await initOverlayElementPorts();

      triggerPortOnDisconnectEvent(buttonPortSpy);
      triggerPortOnDisconnectEvent(listPortSpy);
      await flushPromises();

      expect(overlayBackground["inlineMenuListPort"]).toBeNull();
      expect(overlayBackground["inlineMenuButtonPort"]).toBeNull();
    });
  });
});
