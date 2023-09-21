import { mock, mockReset } from "jest-mock-extended";

import { UserVerificationService } from "@bitwarden/common/auth/services/user-verification/user-verification.service";
import {
  EventType,
  FieldType,
  LinkedIdType,
  LoginLinkedId,
  UriMatchType,
} from "@bitwarden/common/enums";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EventCollectionService } from "@bitwarden/common/services/event/event-collection.service";
import { SettingsService } from "@bitwarden/common/services/settings.service";
import { TotpService } from "@bitwarden/common/services/totp.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";

import { BrowserApi } from "../../platform/browser/browser-api";
import { BrowserStateService } from "../../platform/services/browser-state.service";
import {
  createAutofillFieldMock,
  createAutofillPageDetailsMock,
  createAutofillScriptMock,
  createChromeTabMock,
  createGenerateFillScriptOptionsMock,
} from "../jest/autofill-mocks";
import { triggerTestFailure } from "../jest/testing-utils";
import AutofillField from "../models/autofill-field";
import AutofillPageDetails from "../models/autofill-page-details";
import AutofillScript from "../models/autofill-script";

import {
  AutoFillOptions,
  GenerateFillScriptOptions,
  PageDetail,
} from "./abstractions/autofill.service";
import { AutoFillConstants, IdentityAutoFillConstants } from "./autofill-constants";
import AutofillService from "./autofill.service";

describe("AutofillService", () => {
  let autofillService: AutofillService;
  const cipherService = mock<CipherService>();
  const stateService = mock<BrowserStateService>();
  const totpService = mock<TotpService>();
  const eventCollectionService = mock<EventCollectionService>();
  const logService = mock<LogService>();
  const settingsService = mock<SettingsService>();
  const userVerificationService = mock<UserVerificationService>();

  beforeEach(() => {
    autofillService = new AutofillService(
      cipherService,
      stateService,
      totpService,
      eventCollectionService,
      logService,
      settingsService,
      userVerificationService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockReset(cipherService);
  });

  describe("injectAutofillScripts", () => {
    const autofillV1Script = "autofill.js";
    const autofillV2Script = "autofill-init.js";
    const defaultAutofillScripts = ["autofiller.js", "notificationBar.js", "contextMenuHandler.js"];
    const defaultExecuteScriptOptions = { runAt: "document_start" };
    let tabMock: chrome.tabs.Tab;
    let sender: chrome.runtime.MessageSender;

    beforeEach(() => {
      tabMock = createChromeTabMock();
      sender = { tab: tabMock };
      jest.spyOn(BrowserApi, "executeScriptInTab").mockImplementation();
    });

    it("accepts an extension message sender and injects the autofill scripts into the tab of the sender", async () => {
      await autofillService.injectAutofillScripts(sender);

      [autofillV1Script, ...defaultAutofillScripts].forEach((scriptName) => {
        expect(BrowserApi.executeScriptInTab).toHaveBeenCalledWith(tabMock.id, {
          file: `content/${scriptName}`,
          frameId: sender.frameId,
          ...defaultExecuteScriptOptions,
        });
      });
      expect(BrowserApi.executeScriptInTab).not.toHaveBeenCalledWith(tabMock.id, {
        file: `content/${autofillV2Script}`,
        frameId: sender.frameId,
        ...defaultExecuteScriptOptions,
      });
    });

    it("will inject the autofill-init class if the enableAutofillV2 flag is set", () => {
      autofillService.injectAutofillScripts(sender, true);

      expect(BrowserApi.executeScriptInTab).toHaveBeenCalledWith(tabMock.id, {
        file: `content/${autofillV2Script}`,
        ...defaultExecuteScriptOptions,
      });
      expect(BrowserApi.executeScriptInTab).not.toHaveBeenCalledWith(tabMock.id, {
        file: `content/${autofillV1Script}`,
        ...defaultExecuteScriptOptions,
      });
    });
  });

  describe("getFormsWithPasswordFields", () => {
    let pageDetailsMock: AutofillPageDetails;

    beforeEach(() => {
      pageDetailsMock = createAutofillPageDetailsMock();
    });

    it("returns an empty FormData array if no password fields are found", () => {
      jest.spyOn(AutofillService, "loadPasswordFields");

      const formData = autofillService.getFormsWithPasswordFields(pageDetailsMock);

      expect(AutofillService.loadPasswordFields).toHaveBeenCalledWith(
        pageDetailsMock,
        true,
        true,
        false,
        true
      );
      expect(formData).toStrictEqual([]);
    });

    it("returns an FormData array containing a form with it's autofill data", () => {
      const usernameInputField = createAutofillFieldMock({
        opid: "username-field",
        form: "validFormId",
        elementNumber: 1,
      });
      const passwordInputField = createAutofillFieldMock({
        opid: "password-field",
        type: "password",
        form: "validFormId",
        elementNumber: 2,
      });
      pageDetailsMock.fields = [usernameInputField, passwordInputField];

      const formData = autofillService.getFormsWithPasswordFields(pageDetailsMock);

      expect(formData).toStrictEqual([
        {
          form: pageDetailsMock.forms.validFormId,
          password: pageDetailsMock.fields[1],
          passwords: [pageDetailsMock.fields[1]],
          username: pageDetailsMock.fields[0],
        },
      ]);
    });

    it("narrows down three passwords that are present on a page to a single password field to autofill when only one form element is present on the page", () => {
      const usernameInputField = createAutofillFieldMock({
        opid: "username-field",
        form: "validFormId",
        elementNumber: 1,
      });
      const passwordInputField = createAutofillFieldMock({
        opid: "password-field",
        type: "password",
        form: "validFormId",
        elementNumber: 2,
      });
      const secondPasswordInputField = createAutofillFieldMock({
        opid: "another-password-field",
        type: "password",
        form: undefined,
        elementNumber: 3,
      });
      const thirdPasswordInputField = createAutofillFieldMock({
        opid: "a-third-password-field",
        type: "password",
        form: undefined,
        elementNumber: 4,
      });
      pageDetailsMock.fields = [
        usernameInputField,
        passwordInputField,
        secondPasswordInputField,
        thirdPasswordInputField,
      ];

      const formData = autofillService.getFormsWithPasswordFields(pageDetailsMock);

      expect(formData).toStrictEqual([
        {
          form: pageDetailsMock.forms.validFormId,
          password: pageDetailsMock.fields[1],
          passwords: [
            pageDetailsMock.fields[1],
            { ...pageDetailsMock.fields[2], form: pageDetailsMock.fields[1].form },
            { ...pageDetailsMock.fields[3], form: pageDetailsMock.fields[1].form },
          ],
          username: pageDetailsMock.fields[0],
        },
      ]);
    });

    it("will check for a hidden username field", () => {
      const usernameInputField = createAutofillFieldMock({
        opid: "username-field",
        form: "validFormId",
        elementNumber: 1,
        isViewable: false,
        readonly: true,
      });
      const passwordInputField = createAutofillFieldMock({
        opid: "password-field",
        type: "password",
        form: "validFormId",
        elementNumber: 2,
      });
      pageDetailsMock.fields = [usernameInputField, passwordInputField];
      jest.spyOn(autofillService as any, "findUsernameField");

      const formData = autofillService.getFormsWithPasswordFields(pageDetailsMock);

      expect(autofillService["findUsernameField"]).toHaveBeenCalledWith(
        pageDetailsMock,
        passwordInputField,
        true,
        true,
        false
      );
      expect(formData).toStrictEqual([
        {
          form: pageDetailsMock.forms.validFormId,
          password: pageDetailsMock.fields[1],
          passwords: [pageDetailsMock.fields[1]],
          username: pageDetailsMock.fields[0],
        },
      ]);
    });
  });

  describe("doAutoFill", () => {
    let autofillOptions: AutoFillOptions;
    const nothingToAutofillError = "Nothing to auto-fill.";
    const didNotAutofillError = "Did not auto-fill.";

    beforeEach(() => {
      autofillOptions = {
        cipher: mock<CipherView>({
          id: "cipherId",
          type: CipherType.Login,
        }),
        pageDetails: [
          {
            frameId: 1,
            tab: createChromeTabMock(),
            details: createAutofillPageDetailsMock({
              fields: [
                createAutofillFieldMock({
                  opid: "username-field",
                  form: "validFormId",
                  elementNumber: 1,
                }),
                createAutofillFieldMock({
                  opid: "password-field",
                  type: "password",
                  form: "validFormId",
                  elementNumber: 2,
                }),
              ],
            }),
          },
        ],
        tab: createChromeTabMock(),
      };
      autofillOptions.cipher.fields = [mock<FieldView>({ name: "username" })];
      autofillOptions.cipher.login.matchesUri = jest.fn().mockReturnValue(true);
      autofillOptions.cipher.login.username = "username";
      autofillOptions.cipher.login.password = "password";
    });

    describe("given a set of autofill options that are incomplete", () => {
      it("throws an error if the tab is not provided", async () => {
        autofillOptions.tab = undefined;

        try {
          await autofillService.doAutoFill(autofillOptions);
          triggerTestFailure();
        } catch (error) {
          expect(error.message).toBe(nothingToAutofillError);
        }
      });

      it("throws an error if the cipher is not provided", async () => {
        autofillOptions.cipher = undefined;

        try {
          await autofillService.doAutoFill(autofillOptions);
          triggerTestFailure();
        } catch (error) {
          expect(error.message).toBe(nothingToAutofillError);
        }
      });

      it("throws an error if the page details are not provided", async () => {
        autofillOptions.pageDetails = undefined;

        try {
          await autofillService.doAutoFill(autofillOptions);
          triggerTestFailure();
        } catch (error) {
          expect(error.message).toBe(nothingToAutofillError);
        }
      });

      it("throws an error if the page details are empty", async () => {
        autofillOptions.pageDetails = [];

        try {
          await autofillService.doAutoFill(autofillOptions);
          triggerTestFailure();
        } catch (error) {
          expect(error.message).toBe(nothingToAutofillError);
        }
      });

      it("throws an error if an autofill did not occur for any of the passed pages", async () => {
        autofillOptions.tab.url = "https://a-different-url.com";

        try {
          await autofillService.doAutoFill(autofillOptions);
          triggerTestFailure();
        } catch (error) {
          expect(error.message).toBe(didNotAutofillError);
        }
      });
    });

    it("will autofill login data for a page", async () => {
      jest.spyOn(stateService, "getCanAccessPremium");
      jest.spyOn(stateService, "getDefaultUriMatch");
      jest.spyOn(autofillService as any, "generateFillScript");
      jest.spyOn(autofillService as any, "generateLoginFillScript");
      jest.spyOn(logService, "info");
      jest.spyOn(cipherService, "updateLastUsedDate");
      jest.spyOn(eventCollectionService, "collect");

      const autofillResult = await autofillService.doAutoFill(autofillOptions);

      const currentAutofillPageDetails = autofillOptions.pageDetails[0];
      expect(stateService.getCanAccessPremium).toHaveBeenCalled();
      expect(stateService.getDefaultUriMatch).toHaveBeenCalled();
      expect(autofillService["generateFillScript"]).toHaveBeenCalledWith(
        currentAutofillPageDetails.details,
        {
          skipUsernameOnlyFill: autofillOptions.skipUsernameOnlyFill || false,
          onlyEmptyFields: autofillOptions.onlyEmptyFields || false,
          onlyVisibleFields: autofillOptions.onlyVisibleFields || false,
          fillNewPassword: autofillOptions.fillNewPassword || false,
          allowTotpAutofill: autofillOptions.allowTotpAutofill || false,
          cipher: autofillOptions.cipher,
          tabUrl: autofillOptions.tab.url,
          defaultUriMatch: 0,
        }
      );
      expect(autofillService["generateLoginFillScript"]).toHaveBeenCalled();
      expect(logService.info).not.toHaveBeenCalled();
      expect(cipherService.updateLastUsedDate).toHaveBeenCalledWith(autofillOptions.cipher.id);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        autofillOptions.pageDetails[0].tab.id,
        {
          command: "fillForm",
          fillScript: {
            autosubmit: null,
            metadata: {},
            properties: {
              delay_between_operations: 20,
            },
            savedUrls: [],
            script: [
              ["click_on_opid", "username-field"],
              ["focus_by_opid", "username-field"],
              ["fill_by_opid", "username-field", "username"],
              ["click_on_opid", "password-field"],
              ["focus_by_opid", "password-field"],
              ["fill_by_opid", "password-field", "password"],
              ["focus_by_opid", "password-field"],
            ],
            untrustedIframe: false,
          },
          url: currentAutofillPageDetails.tab.url,
        },
        {
          frameId: currentAutofillPageDetails.frameId,
        },
        expect.any(Function)
      );
      expect(eventCollectionService.collect).toHaveBeenCalledWith(
        EventType.Cipher_ClientAutofilled,
        autofillOptions.cipher.id
      );
      expect(autofillResult).toBeNull();
    });

    it("will autofill card data for a page", async () => {
      autofillOptions.cipher.type = CipherType.Card;
      autofillOptions.cipher.card = mock<CardView>({
        cardholderName: "cardholderName",
      });
      autofillOptions.pageDetails[0].details.fields = [
        createAutofillFieldMock({
          opid: "cardholderName",
          form: "validFormId",
          elementNumber: 2,
          autoCompleteType: "cc-name",
        }),
      ];
      jest.spyOn(autofillService as any, "generateCardFillScript");
      jest.spyOn(eventCollectionService, "collect");

      await autofillService.doAutoFill(autofillOptions);

      expect(autofillService["generateCardFillScript"]).toHaveBeenCalled();
      expect(chrome.tabs.sendMessage).toHaveBeenCalled();
      expect(eventCollectionService.collect).toHaveBeenCalledWith(
        EventType.Cipher_ClientAutofilled,
        autofillOptions.cipher.id
      );
    });

    it("will autofill identity data for a page", async () => {
      autofillOptions.cipher.type = CipherType.Identity;
      autofillOptions.cipher.identity = mock<IdentityView>({
        firstName: "firstName",
        middleName: "middleName",
        lastName: "lastName",
      });
      autofillOptions.pageDetails[0].details.fields = [
        createAutofillFieldMock({
          opid: "full-name",
          form: "validFormId",
          elementNumber: 2,
          autoCompleteType: "full-name",
        }),
      ];
      jest.spyOn(autofillService as any, "generateIdentityFillScript");
      jest.spyOn(eventCollectionService, "collect");

      await autofillService.doAutoFill(autofillOptions);

      expect(autofillService["generateIdentityFillScript"]).toHaveBeenCalled();
      expect(chrome.tabs.sendMessage).toHaveBeenCalled();
      expect(eventCollectionService.collect).toHaveBeenCalledWith(
        EventType.Cipher_ClientAutofilled,
        autofillOptions.cipher.id
      );
    });

    it("blocks autofill on an untrusted iframe", async () => {
      autofillOptions.allowUntrustedIframe = false;
      autofillOptions.cipher.login.matchesUri = jest.fn().mockReturnValueOnce(false);
      jest.spyOn(logService, "info");

      try {
        await autofillService.doAutoFill(autofillOptions);
        triggerTestFailure();
      } catch (error) {
        expect(logService.info).toHaveBeenCalledWith(
          "Auto-fill on page load was blocked due to an untrusted iframe."
        );
        expect(error.message).toBe(didNotAutofillError);
      }
    });

    it("allows autofill on an untrusted iframe if the passed option allowing untrusted iframes is set to true", async () => {
      autofillOptions.allowUntrustedIframe = true;
      autofillOptions.cipher.login.matchesUri = jest.fn().mockReturnValue(false);
      jest.spyOn(logService, "info");

      await autofillService.doAutoFill(autofillOptions);

      expect(logService.info).not.toHaveBeenCalledWith(
        "Auto-fill on page load was blocked due to an untrusted iframe."
      );
    });

    it("skips updating the cipher's last used date if the passed options indicate that we should skip the last used cipher", async () => {
      autofillOptions.skipLastUsed = true;
      jest.spyOn(cipherService, "updateLastUsedDate");

      await autofillService.doAutoFill(autofillOptions);

      expect(cipherService.updateLastUsedDate).not.toHaveBeenCalled();
    });

    it("returns early if the fillScript cannot be generated", async () => {
      jest.spyOn(autofillService as any, "generateFillScript").mockReturnValueOnce(undefined);
      jest.spyOn(BrowserApi, "tabSendMessage");

      try {
        await autofillService.doAutoFill(autofillOptions);
        triggerTestFailure();
      } catch (error) {
        expect(autofillService["generateFillScript"]).toHaveBeenCalled();
        expect(BrowserApi.tabSendMessage).not.toHaveBeenCalled();
        expect(error.message).toBe(didNotAutofillError);
      }
    });

    it("returns a TOTP value", async () => {
      const totpCode = "123456";
      autofillOptions.cipher.login.totp = "totp";
      jest.spyOn(stateService, "getDisableAutoTotpCopy").mockResolvedValueOnce(false);
      jest.spyOn(totpService, "getCode").mockReturnValueOnce(Promise.resolve(totpCode));

      const autofillResult = await autofillService.doAutoFill(autofillOptions);

      expect(stateService.getDisableAutoTotpCopy).toHaveBeenCalled();
      expect(totpService.getCode).toHaveBeenCalledWith(autofillOptions.cipher.login.totp);
      expect(autofillResult).toBe(totpCode);
    });

    it("returns a null value if the cipher type is not for a Login", async () => {
      autofillOptions.cipher.type = CipherType.Identity;
      autofillOptions.cipher.identity = mock<IdentityView>();

      const autofillResult = await autofillService.doAutoFill(autofillOptions);

      expect(autofillResult).toBeNull();
    });

    it("returns a null value if the login does not contain a TOTP value", async () => {
      autofillOptions.cipher.login.totp = undefined;
      jest.spyOn(stateService, "getDisableAutoTotpCopy");
      jest.spyOn(totpService, "getCode");

      const autofillResult = await autofillService.doAutoFill(autofillOptions);

      expect(stateService.getDisableAutoTotpCopy).not.toHaveBeenCalled();
      expect(totpService.getCode).not.toHaveBeenCalled();
      expect(autofillResult).toBeNull();
    });

    it("returns a null value if the user cannot access premium and the organization does not use TOTP", async () => {
      autofillOptions.cipher.login.totp = "totp";
      autofillOptions.cipher.organizationUseTotp = false;
      jest.spyOn(stateService, "getCanAccessPremium").mockResolvedValueOnce(false);

      const autofillResult = await autofillService.doAutoFill(autofillOptions);

      expect(autofillResult).toBeNull();
    });

    it("returns a null value if the user has disabled `auto TOTP copy`", async () => {
      autofillOptions.cipher.login.totp = "totp";
      autofillOptions.cipher.organizationUseTotp = true;
      jest.spyOn(stateService, "getCanAccessPremium").mockResolvedValueOnce(true);
      jest.spyOn(stateService, "getDisableAutoTotpCopy").mockResolvedValueOnce(true);

      const autofillResult = await autofillService.doAutoFill(autofillOptions);

      expect(autofillResult).toBeNull();
    });
  });

  describe("doAutoFillOnTab", () => {
    let pageDetails: PageDetail[];
    let tab: chrome.tabs.Tab;

    beforeEach(() => {
      tab = createChromeTabMock();
      pageDetails = [
        {
          frameId: 1,
          tab: createChromeTabMock(),
          details: createAutofillPageDetailsMock({
            fields: [
              createAutofillFieldMock({
                opid: "username-field",
                form: "validFormId",
                elementNumber: 1,
              }),
              createAutofillFieldMock({
                opid: "password-field",
                type: "password",
                form: "validFormId",
                elementNumber: 2,
              }),
            ],
          }),
        },
      ];
    });

    describe("given a tab url which does not match a cipher", () => {
      it("will skip autofill and return a null value when triggering on page load", async () => {
        jest.spyOn(autofillService, "doAutoFill");
        jest.spyOn(cipherService, "getNextCipherForUrl");
        jest.spyOn(cipherService, "getLastLaunchedForUrl").mockResolvedValueOnce(null);
        jest.spyOn(cipherService, "getLastUsedForUrl").mockResolvedValueOnce(null);

        const result = await autofillService.doAutoFillOnTab(pageDetails, tab, false);

        expect(cipherService.getNextCipherForUrl).not.toHaveBeenCalled();
        expect(cipherService.getLastLaunchedForUrl).toHaveBeenCalledWith(tab.url, true);
        expect(cipherService.getLastUsedForUrl).toHaveBeenCalledWith(tab.url, true);
        expect(autofillService.doAutoFill).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it("will skip autofill and return a null value when triggering from a keyboard shortcut", async () => {
        jest.spyOn(autofillService, "doAutoFill");
        jest.spyOn(cipherService, "getNextCipherForUrl").mockResolvedValueOnce(null);
        jest.spyOn(cipherService, "getLastLaunchedForUrl").mockResolvedValueOnce(null);
        jest.spyOn(cipherService, "getLastUsedForUrl").mockResolvedValueOnce(null);

        const result = await autofillService.doAutoFillOnTab(pageDetails, tab, true);

        expect(cipherService.getNextCipherForUrl).toHaveBeenCalledWith(tab.url);
        expect(cipherService.getLastLaunchedForUrl).not.toHaveBeenCalled();
        expect(cipherService.getLastUsedForUrl).not.toHaveBeenCalled();
        expect(autofillService.doAutoFill).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });

    describe("given a tab url which matches a cipher", () => {
      let cipher: CipherView;

      beforeEach(() => {
        cipher = mock<CipherView>({
          reprompt: CipherRepromptType.None,
          localData: {
            lastLaunched: Date.now().valueOf(),
          },
        });
      });

      it("will autofill the last launched cipher and return a TOTP value when triggering on page load", async () => {
        const totpCode = "123456";
        const fromCommand = false;
        jest.spyOn(autofillService, "doAutoFill").mockResolvedValueOnce(totpCode);
        jest.spyOn(cipherService, "getLastLaunchedForUrl").mockResolvedValueOnce(cipher);
        jest.spyOn(cipherService, "getLastUsedForUrl");
        jest.spyOn(cipherService, "updateLastUsedIndexForUrl");

        const result = await autofillService.doAutoFillOnTab(pageDetails, tab, fromCommand);

        expect(cipherService.getLastLaunchedForUrl).toHaveBeenCalledWith(tab.url, true);
        expect(cipherService.getLastUsedForUrl).not.toHaveBeenCalled();
        expect(cipherService.updateLastUsedIndexForUrl).not.toHaveBeenCalled();
        expect(autofillService.doAutoFill).toHaveBeenCalledWith({
          tab: tab,
          cipher: cipher,
          pageDetails: pageDetails,
          skipLastUsed: !fromCommand,
          skipUsernameOnlyFill: !fromCommand,
          onlyEmptyFields: !fromCommand,
          onlyVisibleFields: !fromCommand,
          fillNewPassword: fromCommand,
          allowUntrustedIframe: fromCommand,
          allowTotpAutofill: fromCommand,
        });
        expect(result).toBe(totpCode);
      });

      it("will autofill the last used cipher and return a TOTP value when triggering on page load ", async () => {
        cipher.localData.lastLaunched = Date.now().valueOf() - 30001;
        const totpCode = "123456";
        const fromCommand = false;
        jest.spyOn(autofillService, "doAutoFill").mockResolvedValueOnce(totpCode);
        jest.spyOn(cipherService, "getLastLaunchedForUrl").mockResolvedValueOnce(cipher);
        jest.spyOn(cipherService, "getLastUsedForUrl").mockResolvedValueOnce(cipher);
        jest.spyOn(cipherService, "updateLastUsedIndexForUrl");

        const result = await autofillService.doAutoFillOnTab(pageDetails, tab, fromCommand);

        expect(cipherService.getLastLaunchedForUrl).toHaveBeenCalledWith(tab.url, true);
        expect(cipherService.getLastUsedForUrl).toHaveBeenCalledWith(tab.url, true);
        expect(cipherService.updateLastUsedIndexForUrl).not.toHaveBeenCalled();
        expect(autofillService.doAutoFill).toHaveBeenCalledWith({
          tab: tab,
          cipher: cipher,
          pageDetails: pageDetails,
          skipLastUsed: !fromCommand,
          skipUsernameOnlyFill: !fromCommand,
          onlyEmptyFields: !fromCommand,
          onlyVisibleFields: !fromCommand,
          fillNewPassword: fromCommand,
          allowUntrustedIframe: fromCommand,
          allowTotpAutofill: fromCommand,
        });
        expect(result).toBe(totpCode);
      });

      it("will autofill the next cipher, update the last used cipher index, and return a TOTP value when triggering from a keyboard shortcut", async () => {
        const totpCode = "123456";
        const fromCommand = true;
        jest.spyOn(autofillService, "doAutoFill").mockResolvedValueOnce(totpCode);
        jest.spyOn(cipherService, "getNextCipherForUrl").mockResolvedValueOnce(cipher);
        jest.spyOn(cipherService, "updateLastUsedIndexForUrl");

        const result = await autofillService.doAutoFillOnTab(pageDetails, tab, fromCommand);

        expect(cipherService.getNextCipherForUrl).toHaveBeenCalledWith(tab.url);
        expect(cipherService.updateLastUsedIndexForUrl).toHaveBeenCalledWith(tab.url);
        expect(autofillService.doAutoFill).toHaveBeenCalledWith({
          tab: tab,
          cipher: cipher,
          pageDetails: pageDetails,
          skipLastUsed: !fromCommand,
          skipUsernameOnlyFill: !fromCommand,
          onlyEmptyFields: !fromCommand,
          onlyVisibleFields: !fromCommand,
          fillNewPassword: fromCommand,
          allowUntrustedIframe: fromCommand,
          allowTotpAutofill: fromCommand,
        });
        expect(result).toBe(totpCode);
      });

      it("will skip autofill, launch the password reprompt window, and return a null value if the cipher re-prompt type is not `None`", async () => {
        cipher.reprompt = CipherRepromptType.Password;
        jest.spyOn(autofillService, "doAutoFill");
        jest.spyOn(cipherService, "getNextCipherForUrl").mockResolvedValueOnce(cipher);
        jest
          .spyOn(userVerificationService, "hasMasterPasswordAndMasterKeyHash")
          .mockResolvedValueOnce(true);
        jest.spyOn(BrowserApi, "tabSendMessageData").mockImplementation();

        const result = await autofillService.doAutoFillOnTab(pageDetails, tab, true);

        expect(cipherService.getNextCipherForUrl).toHaveBeenCalledWith(tab.url);
        expect(userVerificationService.hasMasterPasswordAndMasterKeyHash).toHaveBeenCalled();
        expect(BrowserApi.tabSendMessageData).toHaveBeenCalledWith(tab, "passwordReprompt", {
          cipherId: cipher.id,
          action: "autofill",
        });
        expect(autofillService.doAutoFill).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });
  });

  describe("doAutoFillActiveTab", () => {
    let pageDetails: PageDetail[];
    let tab: chrome.tabs.Tab;

    beforeEach(() => {
      tab = createChromeTabMock();
      pageDetails = [
        {
          frameId: 1,
          tab: createChromeTabMock(),
          details: createAutofillPageDetailsMock({
            fields: [
              createAutofillFieldMock({
                opid: "username-field",
                form: "validFormId",
                elementNumber: 1,
              }),
              createAutofillFieldMock({
                opid: "password-field",
                type: "password",
                form: "validFormId",
                elementNumber: 2,
              }),
            ],
          }),
        },
      ];
    });

    it("returns a null value without doing autofill if the active tab cannot be found", async () => {
      jest.spyOn(autofillService as any, "getActiveTab").mockResolvedValueOnce(undefined);
      jest.spyOn(autofillService, "doAutoFill");

      const result = await autofillService.doAutoFillActiveTab(pageDetails, false);

      expect(autofillService["getActiveTab"]).toHaveBeenCalled();
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("returns a null value without doing autofill if the active tab url cannot be found", async () => {
      jest.spyOn(autofillService as any, "getActiveTab").mockResolvedValueOnce({
        id: 1,
        url: undefined,
      });
      jest.spyOn(autofillService, "doAutoFill");

      const result = await autofillService.doAutoFillActiveTab(pageDetails, false);

      expect(autofillService["getActiveTab"]).toHaveBeenCalled();
      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("queries the active tab and enacts an autofill on that tab", async () => {
      const totp = "123456";
      const fromCommand = false;
      jest.spyOn(autofillService as any, "getActiveTab").mockResolvedValueOnce(tab);
      jest.spyOn(autofillService, "doAutoFillOnTab").mockResolvedValueOnce(totp);

      const result = await autofillService.doAutoFillActiveTab(pageDetails, fromCommand);

      expect(autofillService["getActiveTab"]).toHaveBeenCalled();
      expect(autofillService.doAutoFillOnTab).toHaveBeenCalledWith(pageDetails, tab, fromCommand);
      expect(result).toBe(totp);
    });
  });

  describe("getActiveTab", () => {
    it("throws are error if a tab cannot be found", async () => {
      jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValueOnce(undefined);

      try {
        await autofillService["getActiveTab"]();
        triggerTestFailure();
      } catch (error) {
        expect(BrowserApi.getTabFromCurrentWindow).toHaveBeenCalled();
        expect(error.message).toBe("No tab found.");
      }
    });

    it("returns the active tab from the current window", async () => {
      const tab = createChromeTabMock();
      jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValueOnce(tab);

      const result = await autofillService["getActiveTab"]();
      expect(BrowserApi.getTabFromCurrentWindow).toHaveBeenCalled();
      expect(result).toBe(tab);
    });
  });

  describe("generateFillScript", () => {
    let defaultUsernameField: AutofillField;
    let defaultUsernameFieldView: FieldView;
    let defaultPasswordField: AutofillField;
    let defaultPasswordFieldView: FieldView;
    let pageDetail: AutofillPageDetails;
    let generateFillScriptOptions: GenerateFillScriptOptions;

    beforeEach(() => {
      defaultUsernameField = createAutofillFieldMock({
        opid: "username-field",
        form: "validFormId",
        htmlID: "username",
        elementNumber: 1,
      });
      defaultUsernameFieldView = mock<FieldView>({
        name: "username",
        value: defaultUsernameField.value,
      });
      defaultPasswordField = createAutofillFieldMock({
        opid: "password-field",
        type: "password",
        form: "validFormId",
        htmlID: "password",
        elementNumber: 2,
      });
      defaultPasswordFieldView = mock<FieldView>({
        name: "password",
        value: defaultPasswordField.value,
      });
      pageDetail = createAutofillPageDetailsMock({
        fields: [defaultUsernameField, defaultPasswordField],
      });
      generateFillScriptOptions = createGenerateFillScriptOptionsMock();
      generateFillScriptOptions.cipher.fields = [
        defaultUsernameFieldView,
        defaultPasswordFieldView,
      ];
    });

    it("returns null if the page details are not provided", async () => {
      const value = await autofillService["generateFillScript"](
        undefined,
        generateFillScriptOptions
      );

      expect(value).toBeNull();
    });

    it("returns null if the passed options do not contain a valid cipher", async () => {
      generateFillScriptOptions.cipher = undefined;

      const value = await autofillService["generateFillScript"](
        pageDetail,
        generateFillScriptOptions
      );

      expect(value).toBeNull();
    });

    describe("given a valid set of cipher fields and page detail fields", () => {
      it("will not attempt to fill by opid duplicate fields found within the page details", async () => {
        const duplicateUsernameField: AutofillField = createAutofillFieldMock({
          opid: "username-field",
          form: "validFormId",
          htmlID: "username",
          elementNumber: 3,
        });
        pageDetail.fields.push(duplicateUsernameField);
        jest.spyOn(generateFillScriptOptions.cipher, "linkedFieldValue");
        jest.spyOn(autofillService as any, "findMatchingFieldIndex");
        jest.spyOn(AutofillService, "fillByOpid");

        await autofillService["generateFillScript"](pageDetail, generateFillScriptOptions);

        expect(AutofillService.fillByOpid).not.toHaveBeenCalledWith(
          expect.anything(),
          duplicateUsernameField,
          duplicateUsernameField.value
        );
      });

      it("will not attempt to fill by opid fields that are not viewable and are not a `span` element", async () => {
        defaultUsernameField.viewable = false;
        jest.spyOn(AutofillService, "fillByOpid");

        await autofillService["generateFillScript"](pageDetail, generateFillScriptOptions);

        expect(AutofillService.fillByOpid).not.toHaveBeenCalledWith(
          expect.anything(),
          defaultUsernameField,
          defaultUsernameField.value
        );
      });

      it("will fill by opid fields that are not viewable but are a `span` element", async () => {
        defaultUsernameField.viewable = false;
        defaultUsernameField.tagName = "span";
        jest.spyOn(AutofillService, "fillByOpid");

        await autofillService["generateFillScript"](pageDetail, generateFillScriptOptions);

        expect(AutofillService.fillByOpid).toHaveBeenNthCalledWith(
          1,
          expect.anything(),
          defaultUsernameField,
          defaultUsernameField.value
        );
      });

      it("will not attempt to fill by opid fields that do not contain a property that matches the field name", async () => {
        defaultUsernameField.htmlID = "does-not-match-username";
        jest.spyOn(AutofillService, "fillByOpid");

        await autofillService["generateFillScript"](pageDetail, generateFillScriptOptions);

        expect(AutofillService.fillByOpid).not.toHaveBeenCalledWith(
          expect.anything(),
          defaultUsernameField,
          defaultUsernameField.value
        );
      });

      it("will fill by opid fields that contain a property that matches the field name", async () => {
        jest.spyOn(generateFillScriptOptions.cipher, "linkedFieldValue");
        jest.spyOn(autofillService as any, "findMatchingFieldIndex");
        jest.spyOn(AutofillService, "fillByOpid");

        await autofillService["generateFillScript"](pageDetail, generateFillScriptOptions);

        expect(autofillService["findMatchingFieldIndex"]).toHaveBeenCalledTimes(2);
        expect(generateFillScriptOptions.cipher.linkedFieldValue).not.toHaveBeenCalled();
        expect(AutofillService.fillByOpid).toHaveBeenNthCalledWith(
          1,
          expect.anything(),
          defaultUsernameField,
          defaultUsernameField.value
        );
        expect(AutofillService.fillByOpid).toHaveBeenNthCalledWith(
          2,
          expect.anything(),
          defaultPasswordField,
          defaultPasswordField.value
        );
      });

      it("it will fill by opid fields of type Linked", async () => {
        const fieldLinkedId: LinkedIdType = LoginLinkedId.Username;
        const linkedFieldValue = "linkedFieldValue";
        defaultUsernameFieldView.type = FieldType.Linked;
        defaultUsernameFieldView.linkedId = fieldLinkedId;
        jest
          .spyOn(generateFillScriptOptions.cipher, "linkedFieldValue")
          .mockReturnValueOnce(linkedFieldValue);
        jest.spyOn(AutofillService, "fillByOpid");

        await autofillService["generateFillScript"](pageDetail, generateFillScriptOptions);

        expect(generateFillScriptOptions.cipher.linkedFieldValue).toHaveBeenCalledTimes(1);
        expect(generateFillScriptOptions.cipher.linkedFieldValue).toHaveBeenCalledWith(
          fieldLinkedId
        );
        expect(AutofillService.fillByOpid).toHaveBeenNthCalledWith(
          1,
          expect.anything(),
          defaultUsernameField,
          linkedFieldValue
        );
        expect(AutofillService.fillByOpid).toHaveBeenNthCalledWith(
          2,
          expect.anything(),
          defaultPasswordField,
          defaultPasswordField.value
        );
      });

      it("will fill by opid fields of type Boolean", async () => {
        defaultUsernameFieldView.type = FieldType.Boolean;
        defaultUsernameFieldView.value = "true";
        jest.spyOn(generateFillScriptOptions.cipher, "linkedFieldValue");
        jest.spyOn(AutofillService, "fillByOpid");

        await autofillService["generateFillScript"](pageDetail, generateFillScriptOptions);

        expect(generateFillScriptOptions.cipher.linkedFieldValue).not.toHaveBeenCalled();
        expect(AutofillService.fillByOpid).toHaveBeenNthCalledWith(
          1,
          expect.anything(),
          defaultUsernameField,
          defaultUsernameFieldView.value
        );
      });

      it("will fill by opid fields of type Boolean with a value of false if no value is provided", async () => {
        defaultUsernameFieldView.type = FieldType.Boolean;
        defaultUsernameFieldView.value = undefined;
        jest.spyOn(AutofillService, "fillByOpid");

        await autofillService["generateFillScript"](pageDetail, generateFillScriptOptions);

        expect(AutofillService.fillByOpid).toHaveBeenNthCalledWith(
          1,
          expect.anything(),
          defaultUsernameField,
          "false"
        );
      });
    });

    it("returns a fill script generated for a login autofill", async () => {
      const fillScriptMock = createAutofillScriptMock(
        {},
        { "username-field": "username-value", "password-value": "password-value" }
      );
      generateFillScriptOptions.cipher.type = CipherType.Login;
      jest
        .spyOn(autofillService as any, "generateLoginFillScript")
        .mockReturnValueOnce(fillScriptMock);

      const value = await autofillService["generateFillScript"](
        pageDetail,
        generateFillScriptOptions
      );

      expect(autofillService["generateLoginFillScript"]).toHaveBeenCalledWith(
        {
          autosubmit: null,
          metadata: {},
          properties: {},
          script: [
            ["click_on_opid", "username-field"],
            ["focus_by_opid", "username-field"],
            ["fill_by_opid", "username-field", "default-value"],
            ["click_on_opid", "password-field"],
            ["focus_by_opid", "password-field"],
            ["fill_by_opid", "password-field", "default-value"],
          ],
        },
        pageDetail,
        {
          "password-field": defaultPasswordField,
          "username-field": defaultUsernameField,
        },
        generateFillScriptOptions
      );
      expect(value).toBe(fillScriptMock);
    });

    it("returns a fill script generated for a card autofill", async () => {
      const fillScriptMock = createAutofillScriptMock(
        {},
        { "first-name-field": "first-name-value", "last-name-value": "last-name-value" }
      );
      generateFillScriptOptions.cipher.type = CipherType.Card;
      jest
        .spyOn(autofillService as any, "generateCardFillScript")
        .mockReturnValueOnce(fillScriptMock);

      const value = await autofillService["generateFillScript"](
        pageDetail,
        generateFillScriptOptions
      );

      expect(autofillService["generateCardFillScript"]).toHaveBeenCalledWith(
        {
          autosubmit: null,
          metadata: {},
          properties: {},
          script: [
            ["click_on_opid", "username-field"],
            ["focus_by_opid", "username-field"],
            ["fill_by_opid", "username-field", "default-value"],
            ["click_on_opid", "password-field"],
            ["focus_by_opid", "password-field"],
            ["fill_by_opid", "password-field", "default-value"],
          ],
        },
        pageDetail,
        {
          "password-field": defaultPasswordField,
          "username-field": defaultUsernameField,
        },
        generateFillScriptOptions
      );
      expect(value).toBe(fillScriptMock);
    });

    it("returns a fill script generated for an identity autofill", async () => {
      const fillScriptMock = createAutofillScriptMock(
        {},
        { "first-name-field": "first-name-value", "last-name-value": "last-name-value" }
      );
      generateFillScriptOptions.cipher.type = CipherType.Identity;
      jest
        .spyOn(autofillService as any, "generateIdentityFillScript")
        .mockReturnValueOnce(fillScriptMock);

      const value = await autofillService["generateFillScript"](
        pageDetail,
        generateFillScriptOptions
      );

      expect(autofillService["generateIdentityFillScript"]).toHaveBeenCalledWith(
        {
          autosubmit: null,
          metadata: {},
          properties: {},
          script: [
            ["click_on_opid", "username-field"],
            ["focus_by_opid", "username-field"],
            ["fill_by_opid", "username-field", "default-value"],
            ["click_on_opid", "password-field"],
            ["focus_by_opid", "password-field"],
            ["fill_by_opid", "password-field", "default-value"],
          ],
        },
        pageDetail,
        {
          "password-field": defaultPasswordField,
          "username-field": defaultUsernameField,
        },
        generateFillScriptOptions
      );
      expect(value).toBe(fillScriptMock);
    });

    it("returns null if the cipher type is not for a login, card, or identity", async () => {
      generateFillScriptOptions.cipher.type = CipherType.SecureNote;

      const value = await autofillService["generateFillScript"](
        pageDetail,
        generateFillScriptOptions
      );

      expect(value).toBeNull();
    });
  });

  describe("generateLoginFillScript", () => {
    let fillScript: AutofillScript;
    let pageDetails: AutofillPageDetails;
    let filledFields: { [id: string]: AutofillField };
    let options: GenerateFillScriptOptions;
    let defaultLoginUriView: LoginUriView;

    beforeEach(() => {
      fillScript = createAutofillScriptMock();
      pageDetails = createAutofillPageDetailsMock();
      filledFields = {
        "username-field": createAutofillFieldMock({
          opid: "username-field",
          form: "validFormId",
          elementNumber: 1,
        }),
        "password-field": createAutofillFieldMock({
          opid: "password-field",
          form: "validFormId",
          elementNumber: 2,
        }),
        "totp-field": createAutofillFieldMock({
          opid: "totp-field",
          form: "validFormId",
          elementNumber: 3,
        }),
      };
      defaultLoginUriView = mock<LoginUriView>({
        uri: "https://www.example.com",
        match: UriMatchType.Domain,
      });
      options = createGenerateFillScriptOptionsMock();
      options.cipher.login = mock<LoginView>({
        uris: [defaultLoginUriView],
      });
      options.cipher.login.matchesUri = jest.fn().mockReturnValue(true);
    });

    it("returns null if the cipher does not have login data", async () => {
      options.cipher.login = undefined;
      jest.spyOn(autofillService as any, "inUntrustedIframe");
      jest.spyOn(AutofillService, "loadPasswordFields");
      jest.spyOn(autofillService as any, "findUsernameField");
      jest.spyOn(AutofillService, "fieldIsFuzzyMatch");
      jest.spyOn(AutofillService, "fillByOpid");
      jest.spyOn(AutofillService, "setFillScriptForFocus");

      const value = await autofillService["generateLoginFillScript"](
        fillScript,
        pageDetails,
        filledFields,
        options
      );

      expect(autofillService["inUntrustedIframe"]).not.toHaveBeenCalled();
      expect(AutofillService.loadPasswordFields).not.toHaveBeenCalled();
      expect(autofillService["findUsernameField"]).not.toHaveBeenCalled();
      expect(AutofillService.fieldIsFuzzyMatch).not.toHaveBeenCalled();
      expect(AutofillService.fillByOpid).not.toHaveBeenCalled();
      expect(AutofillService.setFillScriptForFocus).not.toHaveBeenCalled();
      expect(value).toBeNull();
    });

    describe("given a list of login uri views", () => {
      it("returns an empty array of saved login uri views if the login cipher has no login uri views", async () => {
        options.cipher.login.uris = [];

        const value = await autofillService["generateLoginFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.savedUrls).toStrictEqual([]);
      });

      it("returns a list of saved login uri views within the fill script", async () => {
        const secondUriView = mock<LoginUriView>({
          uri: "https://www.second-example.com",
        });
        const thirdUriView = mock<LoginUriView>({
          uri: "https://www.third-example.com",
        });
        options.cipher.login.uris = [defaultLoginUriView, secondUriView, thirdUriView];

        const value = await autofillService["generateLoginFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.savedUrls).toStrictEqual([
          defaultLoginUriView.uri,
          secondUriView.uri,
          thirdUriView.uri,
        ]);
      });

      it("skips adding any login uri views that have a UriMatchType of Never to the list of saved urls", async () => {
        const secondUriView = mock<LoginUriView>({
          uri: "https://www.second-example.com",
        });
        const thirdUriView = mock<LoginUriView>({
          uri: "https://www.third-example.com",
          match: UriMatchType.Never,
        });
        options.cipher.login.uris = [defaultLoginUriView, secondUriView, thirdUriView];

        const value = await autofillService["generateLoginFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.savedUrls).toStrictEqual([defaultLoginUriView.uri, secondUriView.uri]);
        expect(value.savedUrls).not.toContain(thirdUriView.uri);
      });
    });

    describe("given a valid set of page details and autofill options", () => {
      let usernameField: AutofillField;
      let usernameFieldView: FieldView;
      let passwordField: AutofillField;
      let passwordFieldView: FieldView;
      let totpField: AutofillField;
      let totpFieldView: FieldView;

      beforeEach(() => {
        usernameField = createAutofillFieldMock({
          opid: "username",
          form: "validFormId",
          elementNumber: 1,
        });
        usernameFieldView = mock<FieldView>({
          name: "username",
        });
        passwordField = createAutofillFieldMock({
          opid: "password",
          type: "password",
          form: "validFormId",
          elementNumber: 2,
        });
        passwordFieldView = mock<FieldView>({
          name: "password",
        });
        totpField = createAutofillFieldMock({
          opid: "totp",
          type: "text",
          form: "validFormId",
          htmlName: "totpcode",
          elementNumber: 3,
        });
        totpFieldView = mock<FieldView>({
          name: "totp",
        });
        pageDetails.fields = [usernameField, passwordField, totpField];
        options.cipher.fields = [usernameFieldView, passwordFieldView, totpFieldView];
        options.cipher.login.matchesUri = jest.fn().mockReturnValue(true);
        options.cipher.login.username = "username";
        options.cipher.login.password = "password";
        options.cipher.login.totp = "totp";
      });

      it("attempts to load the password fields from hidden and read only elements if no visible password fields are found within the page details", async () => {
        pageDetails.fields = [
          createAutofillFieldMock({
            opid: "password-field",
            type: "password",
            viewable: true,
            readonly: true,
          }),
        ];
        jest.spyOn(AutofillService, "loadPasswordFields");

        await autofillService["generateLoginFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(AutofillService.loadPasswordFields).toHaveBeenCalledTimes(2);
        expect(AutofillService.loadPasswordFields).toHaveBeenNthCalledWith(
          1,
          pageDetails,
          false,
          false,
          options.onlyEmptyFields,
          options.fillNewPassword
        );
        expect(AutofillService.loadPasswordFields).toHaveBeenNthCalledWith(
          2,
          pageDetails,
          true,
          true,
          options.onlyEmptyFields,
          options.fillNewPassword
        );
      });

      describe("given a valid list of forms within the passed page details", () => {
        beforeEach(() => {
          usernameField.viewable = false;
          usernameField.readonly = true;
          totpField.viewable = false;
          totpField.readonly = true;
          jest.spyOn(autofillService as any, "findUsernameField");
          jest.spyOn(autofillService as any, "findTotpField");
        });

        it("will attempt to find a username field from hidden fields if no visible username fields are found", async () => {
          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(autofillService["findUsernameField"]).toHaveBeenCalledTimes(2);
          expect(autofillService["findUsernameField"]).toHaveBeenNthCalledWith(
            1,
            pageDetails,
            passwordField,
            false,
            false,
            false
          );
          expect(autofillService["findUsernameField"]).toHaveBeenNthCalledWith(
            2,
            pageDetails,
            passwordField,
            true,
            true,
            false
          );
        });

        it("will not attempt to find a username field from hidden fields if the passed options indicate only visible fields should be referenced", async () => {
          options.onlyVisibleFields = true;

          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(autofillService["findUsernameField"]).toHaveBeenCalledTimes(1);
          expect(autofillService["findUsernameField"]).toHaveBeenNthCalledWith(
            1,
            pageDetails,
            passwordField,
            false,
            false,
            false
          );
          expect(autofillService["findUsernameField"]).not.toHaveBeenNthCalledWith(
            2,
            pageDetails,
            passwordField,
            true,
            true,
            false
          );
        });

        it("will attempt to find a totp field from hidden fields if no visible totp fields are found", async () => {
          options.allowTotpAutofill = true;
          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(autofillService["findTotpField"]).toHaveBeenCalledTimes(2);
          expect(autofillService["findTotpField"]).toHaveBeenNthCalledWith(
            1,
            pageDetails,
            passwordField,
            false,
            false,
            false
          );
          expect(autofillService["findTotpField"]).toHaveBeenNthCalledWith(
            2,
            pageDetails,
            passwordField,
            true,
            true,
            false
          );
        });

        it("will not attempt to find a totp field from hidden fields if the passed options indicate only visible fields should be referenced", async () => {
          options.allowTotpAutofill = true;
          options.onlyVisibleFields = true;

          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(autofillService["findTotpField"]).toHaveBeenCalledTimes(1);
          expect(autofillService["findTotpField"]).toHaveBeenNthCalledWith(
            1,
            pageDetails,
            passwordField,
            false,
            false,
            false
          );
          expect(autofillService["findTotpField"]).not.toHaveBeenNthCalledWith(
            2,
            pageDetails,
            passwordField,
            true,
            true,
            false
          );
        });

        it("will not attempt to find a totp field from hidden fields if the passed options do not allow for TOTP values to be filled", async () => {
          options.allowTotpAutofill = false;

          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(autofillService["findTotpField"]).not.toHaveBeenCalled();
        });
      });

      describe("given a list of fields without forms within the passed page details", () => {
        beforeEach(() => {
          pageDetails.forms = undefined;
          jest.spyOn(autofillService as any, "findUsernameField");
          jest.spyOn(autofillService as any, "findTotpField");
        });

        it("will attempt to match a password field that does not contain a form to a username field", async () => {
          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(autofillService["findUsernameField"]).toHaveBeenCalledTimes(1);
          expect(autofillService["findUsernameField"]).toHaveBeenCalledWith(
            pageDetails,
            passwordField,
            false,
            false,
            true
          );
        });

        it("will attempt to match a password field that does not contain a form to a username field that is not visible", async () => {
          usernameField.viewable = false;
          usernameField.readonly = true;

          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(autofillService["findUsernameField"]).toHaveBeenCalledTimes(2);
          expect(autofillService["findUsernameField"]).toHaveBeenNthCalledWith(
            1,
            pageDetails,
            passwordField,
            false,
            false,
            true
          );
          expect(autofillService["findUsernameField"]).toHaveBeenNthCalledWith(
            2,
            pageDetails,
            passwordField,
            true,
            true,
            true
          );
        });

        it("will not attempt to match a password field that does not contain a form to a username field that is not visible if the passed options indicate only visible fields", async () => {
          usernameField.viewable = false;
          usernameField.readonly = true;
          options.onlyVisibleFields = true;

          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(autofillService["findUsernameField"]).toHaveBeenCalledTimes(1);
          expect(autofillService["findUsernameField"]).toHaveBeenNthCalledWith(
            1,
            pageDetails,
            passwordField,
            false,
            false,
            true
          );
          expect(autofillService["findUsernameField"]).not.toHaveBeenNthCalledWith(
            2,
            pageDetails,
            passwordField,
            true,
            true,
            true
          );
        });

        it("will attempt to match a password field that does not contain a form to a TOTP field", async () => {
          options.allowTotpAutofill = true;

          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(autofillService["findTotpField"]).toHaveBeenCalledTimes(1);
          expect(autofillService["findTotpField"]).toHaveBeenCalledWith(
            pageDetails,
            passwordField,
            false,
            false,
            true
          );
        });

        it("will attempt to match a password field that does not contain a form to a TOTP field that is not visible", async () => {
          options.onlyVisibleFields = false;
          options.allowTotpAutofill = true;
          totpField.viewable = false;
          totpField.readonly = true;

          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(autofillService["findTotpField"]).toHaveBeenCalledTimes(2);
          expect(autofillService["findTotpField"]).toHaveBeenNthCalledWith(
            1,
            pageDetails,
            passwordField,
            false,
            false,
            true
          );
          expect(autofillService["findTotpField"]).toHaveBeenNthCalledWith(
            2,
            pageDetails,
            passwordField,
            true,
            true,
            true
          );
        });
      });

      describe("given a set of page details that does not contain a password field", () => {
        let emailField: AutofillField;
        let emailFieldView: FieldView;
        let telephoneField: AutofillField;
        let telephoneFieldView: FieldView;
        let totpField: AutofillField;
        let totpFieldView: FieldView;
        let nonViewableField: AutofillField;
        let nonViewableFieldView: FieldView;

        beforeEach(() => {
          usernameField.htmlName = "username";
          emailField = createAutofillFieldMock({
            opid: "email",
            type: "email",
            form: "validFormId",
            elementNumber: 2,
          });
          emailFieldView = mock<FieldView>({
            name: "email",
          });
          telephoneField = createAutofillFieldMock({
            opid: "telephone",
            type: "tel",
            form: "validFormId",
            elementNumber: 3,
          });
          telephoneFieldView = mock<FieldView>({
            name: "telephone",
          });
          totpField = createAutofillFieldMock({
            opid: "totp",
            type: "text",
            form: "validFormId",
            htmlName: "totpcode",
            elementNumber: 4,
          });
          totpFieldView = mock<FieldView>({
            name: "totp",
          });
          nonViewableField = createAutofillFieldMock({
            opid: "non-viewable",
            form: "validFormId",
            viewable: false,
            elementNumber: 4,
          });
          nonViewableFieldView = mock<FieldView>({
            name: "non-viewable",
          });
          pageDetails.fields = [
            usernameField,
            emailField,
            telephoneField,
            totpField,
            nonViewableField,
          ];
          options.cipher.fields = [
            usernameFieldView,
            emailFieldView,
            telephoneFieldView,
            totpFieldView,
            nonViewableFieldView,
          ];
          jest.spyOn(AutofillService, "fieldIsFuzzyMatch");
          jest.spyOn(AutofillService, "fillByOpid");
        });

        it("will attempt to fuzzy match a username to a viewable text, email or tel field if no password fields are found and the username fill is not being skipped", async () => {
          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(AutofillService.fieldIsFuzzyMatch).toHaveBeenCalledTimes(4);
          expect(AutofillService.fieldIsFuzzyMatch).toHaveBeenNthCalledWith(
            1,
            usernameField,
            AutoFillConstants.UsernameFieldNames
          );
          expect(AutofillService.fieldIsFuzzyMatch).toHaveBeenNthCalledWith(
            2,
            emailField,
            AutoFillConstants.UsernameFieldNames
          );
          expect(AutofillService.fieldIsFuzzyMatch).toHaveBeenNthCalledWith(
            3,
            telephoneField,
            AutoFillConstants.UsernameFieldNames
          );
          expect(AutofillService.fieldIsFuzzyMatch).toHaveBeenNthCalledWith(
            4,
            totpField,
            AutoFillConstants.UsernameFieldNames
          );
          expect(AutofillService.fieldIsFuzzyMatch).not.toHaveBeenNthCalledWith(
            5,
            nonViewableField,
            AutoFillConstants.UsernameFieldNames
          );
          expect(AutofillService.fillByOpid).toHaveBeenCalledTimes(1);
          expect(AutofillService.fillByOpid).toHaveBeenCalledWith(
            fillScript,
            usernameField,
            options.cipher.login.username
          );
        });

        it("will not attempt to fuzzy match a username if the username fill is being skipped", async () => {
          options.skipUsernameOnlyFill = true;

          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(AutofillService.fieldIsFuzzyMatch).not.toHaveBeenCalledWith(
            expect.anything(),
            AutoFillConstants.UsernameFieldNames
          );
        });

        it("will attempt to fuzzy match a totp field if totp autofill is allowed", async () => {
          options.allowTotpAutofill = true;

          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(AutofillService.fieldIsFuzzyMatch).toHaveBeenCalledWith(
            expect.anything(),
            AutoFillConstants.TotpFieldNames
          );
        });

        it("will not attempt to fuzzy match a totp field if totp autofill is not allowed", async () => {
          options.allowTotpAutofill = false;

          await autofillService["generateLoginFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(AutofillService.fieldIsFuzzyMatch).not.toHaveBeenCalledWith(
            expect.anything(),
            AutoFillConstants.TotpFieldNames
          );
        });
      });

      it("returns a value indicating if the page url is in an untrusted iframe", async () => {
        jest.spyOn(autofillService as any, "inUntrustedIframe").mockReturnValueOnce(true);

        const value = await autofillService["generateLoginFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.untrustedIframe).toBe(true);
      });

      it("returns a fill script used to autofill a login item", async () => {
        jest.spyOn(autofillService as any, "inUntrustedIframe");
        jest.spyOn(AutofillService, "loadPasswordFields");
        jest.spyOn(autofillService as any, "findUsernameField");
        jest.spyOn(AutofillService, "fieldIsFuzzyMatch");
        jest.spyOn(AutofillService, "fillByOpid");
        jest.spyOn(AutofillService, "setFillScriptForFocus");

        const value = await autofillService["generateLoginFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(autofillService["inUntrustedIframe"]).toHaveBeenCalledWith(pageDetails.url, options);
        expect(AutofillService.loadPasswordFields).toHaveBeenCalledWith(
          pageDetails,
          false,
          false,
          options.onlyEmptyFields,
          options.fillNewPassword
        );
        expect(autofillService["findUsernameField"]).toHaveBeenCalledWith(
          pageDetails,
          passwordField,
          false,
          false,
          false
        );
        expect(AutofillService.fieldIsFuzzyMatch).not.toHaveBeenCalled();
        expect(AutofillService.fillByOpid).toHaveBeenCalledTimes(2);
        expect(AutofillService.fillByOpid).toHaveBeenNthCalledWith(
          1,
          fillScript,
          usernameField,
          options.cipher.login.username
        );
        expect(AutofillService.fillByOpid).toHaveBeenNthCalledWith(
          2,
          fillScript,
          passwordField,
          options.cipher.login.password
        );
        expect(AutofillService.setFillScriptForFocus).toHaveBeenCalledWith(
          filledFields,
          fillScript
        );
        expect(value).toStrictEqual({
          autosubmit: null,
          metadata: {},
          properties: { delay_between_operations: 20 },
          savedUrls: ["https://www.example.com"],
          script: [
            ["click_on_opid", "default-field"],
            ["focus_by_opid", "default-field"],
            ["fill_by_opid", "default-field", "default"],
            ["click_on_opid", "username"],
            ["focus_by_opid", "username"],
            ["fill_by_opid", "username", "username"],
            ["click_on_opid", "password"],
            ["focus_by_opid", "password"],
            ["fill_by_opid", "password", "password"],
            ["focus_by_opid", "password"],
          ],
          itemType: "",
          untrustedIframe: false,
        });
      });
    });
  });

  describe("generateCardFillScript", () => {
    let fillScript: AutofillScript;
    let pageDetails: AutofillPageDetails;
    let filledFields: { [id: string]: AutofillField };
    let options: GenerateFillScriptOptions;

    beforeEach(() => {
      fillScript = createAutofillScriptMock({
        script: [],
      });
      pageDetails = createAutofillPageDetailsMock();
      filledFields = {
        "cardholderName-field": createAutofillFieldMock({
          opid: "cardholderName-field",
          form: "validFormId",
          elementNumber: 1,
          htmlName: "cc-name",
        }),
        "cardNumber-field": createAutofillFieldMock({
          opid: "cardNumber-field",
          form: "validFormId",
          elementNumber: 2,
          htmlName: "cc-number",
        }),
        "expMonth-field": createAutofillFieldMock({
          opid: "expMonth-field",
          form: "validFormId",
          elementNumber: 3,
          htmlName: "exp-month",
        }),
        "expYear-field": createAutofillFieldMock({
          opid: "expYear-field",
          form: "validFormId",
          elementNumber: 4,
          htmlName: "exp-year",
        }),
        "code-field": createAutofillFieldMock({
          opid: "code-field",
          form: "validFormId",
          elementNumber: 1,
          htmlName: "cvc",
        }),
      };
      options = createGenerateFillScriptOptionsMock();
      options.cipher.card = mock<CardView>();
    });

    it("returns null if the passed options contains a cipher with no card view", () => {
      options.cipher.card = undefined;

      const value = autofillService["generateCardFillScript"](
        fillScript,
        pageDetails,
        filledFields,
        options
      );

      expect(value).toBeNull();
    });

    describe("given an invalid autofill field", () => {
      const unmodifiedFillScriptValues: AutofillScript = {
        autosubmit: null,
        metadata: {},
        properties: { delay_between_operations: 20 },
        savedUrls: [],
        script: [],
        itemType: "",
        untrustedIframe: false,
      };

      it("returns an unmodified fill script when the field is a `span` field", () => {
        const spanField = createAutofillFieldMock({
          opid: "span-field",
          form: "validFormId",
          elementNumber: 5,
          htmlName: "spanField",
          tagName: "span",
        });
        pageDetails.fields = [spanField];
        jest.spyOn(AutofillService, "forCustomFieldsOnly");
        jest.spyOn(autofillService as any, "isExcludedType");

        const value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(AutofillService.forCustomFieldsOnly).toHaveBeenCalledWith(spanField);
        expect(autofillService["isExcludedType"]).not.toHaveBeenCalled();
        expect(value).toStrictEqual(unmodifiedFillScriptValues);
      });

      AutoFillConstants.ExcludedAutofillTypes.forEach((excludedType) => {
        it(`returns an unmodified fill script when the field has a '${excludedType}' type`, () => {
          const invalidField = createAutofillFieldMock({
            opid: `${excludedType}-field`,
            form: "validFormId",
            elementNumber: 5,
            htmlName: "invalidField",
            type: excludedType,
          });
          pageDetails.fields = [invalidField];
          jest.spyOn(AutofillService, "forCustomFieldsOnly");
          jest.spyOn(autofillService as any, "isExcludedType");

          const value = autofillService["generateCardFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(AutofillService.forCustomFieldsOnly).toHaveBeenCalledWith(invalidField);
          expect(autofillService["isExcludedType"]).toHaveBeenCalledWith(
            invalidField.type,
            AutoFillConstants.ExcludedAutofillTypes
          );
          expect(value).toStrictEqual(unmodifiedFillScriptValues);
        });
      });

      it("returns an unmodified fill script when the field is not viewable", () => {
        const notViewableField = createAutofillFieldMock({
          opid: "invalid-field",
          form: "validFormId",
          elementNumber: 5,
          htmlName: "invalidField",
          type: "text",
          viewable: false,
        });
        pageDetails.fields = [notViewableField];
        jest.spyOn(AutofillService, "forCustomFieldsOnly");
        jest.spyOn(autofillService as any, "isExcludedType");

        const value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(AutofillService.forCustomFieldsOnly).toHaveBeenCalledWith(notViewableField);
        expect(autofillService["isExcludedType"]).toHaveBeenCalled();
        expect(value).toStrictEqual(unmodifiedFillScriptValues);
      });
    });

    describe("given a valid set of autofill fields", () => {
      let cardholderNameField: AutofillField;
      let cardholderNameFieldView: FieldView;
      let cardNumberField: AutofillField;
      let cardNumberFieldView: FieldView;
      let expMonthField: AutofillField;
      let expMonthFieldView: FieldView;
      let expYearField: AutofillField;
      let expYearFieldView: FieldView;
      let codeField: AutofillField;
      let codeFieldView: FieldView;
      let brandField: AutofillField;
      let brandFieldView: FieldView;

      beforeEach(() => {
        cardholderNameField = createAutofillFieldMock({
          opid: "cardholderName",
          form: "validFormId",
          elementNumber: 1,
          htmlName: "cc-name",
        });
        cardholderNameFieldView = mock<FieldView>({ name: "cardholderName" });
        cardNumberField = createAutofillFieldMock({
          opid: "cardNumber",
          form: "validFormId",
          elementNumber: 2,
          htmlName: "cc-number",
        });
        cardNumberFieldView = mock<FieldView>({ name: "cardNumber" });
        expMonthField = createAutofillFieldMock({
          opid: "expMonth",
          form: "validFormId",
          elementNumber: 3,
          htmlName: "exp-month",
        });
        expMonthFieldView = mock<FieldView>({ name: "expMonth" });
        expYearField = createAutofillFieldMock({
          opid: "expYear",
          form: "validFormId",
          elementNumber: 4,
          htmlName: "exp-year",
        });
        expYearFieldView = mock<FieldView>({ name: "expYear" });
        codeField = createAutofillFieldMock({
          opid: "code",
          form: "validFormId",
          elementNumber: 1,
          htmlName: "cvc",
        });
        brandField = createAutofillFieldMock({
          opid: "brand",
          form: "validFormId",
          elementNumber: 1,
          htmlName: "card-brand",
        });
        brandFieldView = mock<FieldView>({ name: "brand" });
        codeFieldView = mock<FieldView>({ name: "code" });
        pageDetails.fields = [
          cardholderNameField,
          cardNumberField,
          expMonthField,
          expYearField,
          codeField,
          brandField,
        ];
        options.cipher.fields = [
          cardholderNameFieldView,
          cardNumberFieldView,
          expMonthFieldView,
          expYearFieldView,
          codeFieldView,
          brandFieldView,
        ];
        options.cipher.card.cardholderName = "testCardholderName";
        options.cipher.card.number = "testCardNumber";
        options.cipher.card.expMonth = "testExpMonth";
        options.cipher.card.expYear = "testExpYear";
        options.cipher.card.code = "testCode";
        options.cipher.card.brand = "testBrand";
        jest.spyOn(AutofillService, "forCustomFieldsOnly");
        jest.spyOn(autofillService as any, "isExcludedType");
        jest.spyOn(AutofillService as any, "isFieldMatch");
        jest.spyOn(autofillService as any, "makeScriptAction");
        jest.spyOn(AutofillService, "hasValue");
        jest.spyOn(autofillService as any, "fieldAttrsContain");
        jest.spyOn(AutofillService, "fillByOpid");
        jest.spyOn(autofillService as any, "makeScriptActionWithValue");
      });

      it("returns a fill script containing all of the passed card fields", () => {
        const value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(AutofillService.forCustomFieldsOnly).toHaveBeenCalledTimes(6);
        expect(autofillService["isExcludedType"]).toHaveBeenCalledTimes(6);
        expect(AutofillService["isFieldMatch"]).toHaveBeenCalled();
        expect(autofillService["makeScriptAction"]).toHaveBeenCalledTimes(4);
        expect(AutofillService["hasValue"]).toHaveBeenCalledTimes(6);
        expect(autofillService["fieldAttrsContain"]).toHaveBeenCalledTimes(3);
        expect(AutofillService["fillByOpid"]).toHaveBeenCalledTimes(6);
        expect(autofillService["makeScriptActionWithValue"]).toHaveBeenCalledTimes(4);
        expect(value).toStrictEqual({
          autosubmit: null,
          itemType: "",
          metadata: {},
          properties: {
            delay_between_operations: 20,
          },
          savedUrls: [],
          script: [
            ["click_on_opid", "cardholderName"],
            ["focus_by_opid", "cardholderName"],
            ["fill_by_opid", "cardholderName", "testCardholderName"],
            ["click_on_opid", "cardNumber"],
            ["focus_by_opid", "cardNumber"],
            ["fill_by_opid", "cardNumber", "testCardNumber"],
            ["click_on_opid", "code"],
            ["focus_by_opid", "code"],
            ["fill_by_opid", "code", "testCode"],
            ["click_on_opid", "brand"],
            ["focus_by_opid", "brand"],
            ["fill_by_opid", "brand", "testBrand"],
            ["click_on_opid", "expMonth"],
            ["focus_by_opid", "expMonth"],
            ["fill_by_opid", "expMonth", "testExpMonth"],
            ["click_on_opid", "expYear"],
            ["focus_by_opid", "expYear"],
            ["fill_by_opid", "expYear", "testExpYear"],
          ],
          untrustedIframe: false,
        });
      });
    });

    describe("given an expiration month field", () => {
      let expMonthField: AutofillField;
      let expMonthFieldView: FieldView;

      beforeEach(() => {
        expMonthField = createAutofillFieldMock({
          opid: "expMonth",
          form: "validFormId",
          elementNumber: 3,
          htmlName: "exp-month",
          selectInfo: {
            options: [
              ["January", "01"],
              ["February", "02"],
              ["March", "03"],
              ["April", "04"],
              ["May", "05"],
              ["June", "06"],
              ["July", "07"],
              ["August", "08"],
              ["September", "09"],
              ["October", "10"],
              ["November", "11"],
              ["December", "12"],
            ],
          },
        });
        expMonthFieldView = mock<FieldView>({ name: "expMonth" });
        pageDetails.fields = [expMonthField];
        options.cipher.fields = [expMonthFieldView];
        options.cipher.card.expMonth = "05";
      });

      it("returns an expiration month parsed from found select options within the field", () => {
        const testValue = "sometestvalue";
        expMonthField.selectInfo.options[4] = ["May", testValue];

        const value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.script[2]).toStrictEqual(["fill_by_opid", expMonthField.opid, testValue]);
      });

      it("returns an expiration month parsed from found select options within the field when the select field has an empty option at the end of the list of options", () => {
        const testValue = "sometestvalue";
        expMonthField.selectInfo.options[4] = ["May", testValue];
        expMonthField.selectInfo.options.push(["", ""]);

        const value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.script[2]).toStrictEqual(["fill_by_opid", expMonthField.opid, testValue]);
      });

      it("returns an expiration month parsed from found select options within the field when the select field has an empty option at the start of the list of options", () => {
        const testValue = "sometestvalue";
        expMonthField.selectInfo.options[4] = ["May", testValue];
        expMonthField.selectInfo.options.unshift(["", ""]);

        const value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.script[2]).toStrictEqual(["fill_by_opid", expMonthField.opid, testValue]);
      });

      it("returns an expiration month with a zero attached if the field requires two characters, and the vault item has only one character", () => {
        options.cipher.card.expMonth = "5";
        expMonthField.selectInfo = null;
        expMonthField.placeholder = "mm";
        expMonthField.maxLength = 2;

        const value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.script[2]).toStrictEqual(["fill_by_opid", expMonthField.opid, "05"]);
      });
    });

    describe("given an expiration year field", () => {
      let expYearField: AutofillField;
      let expYearFieldView: FieldView;

      beforeEach(() => {
        expYearField = createAutofillFieldMock({
          opid: "expYear",
          form: "validFormId",
          elementNumber: 3,
          htmlName: "exp-year",
          selectInfo: {
            options: [
              ["2023", "2023"],
              ["2024", "2024"],
              ["2025", "2025"],
            ],
          },
        });
        expYearFieldView = mock<FieldView>({ name: "expYear" });
        pageDetails.fields = [expYearField];
        options.cipher.fields = [expYearFieldView];
        options.cipher.card.expYear = "2024";
      });

      it("returns an expiration year parsed from the select options if an exact match is found for either the select option text or value", () => {
        const someTestValue = "sometestvalue";
        expYearField.selectInfo.options[1] = ["2024", someTestValue];
        options.cipher.card.expYear = someTestValue;

        let value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.script[2]).toStrictEqual(["fill_by_opid", expYearField.opid, someTestValue]);

        expYearField.selectInfo.options[1] = [someTestValue, "2024"];

        value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.script[2]).toStrictEqual(["fill_by_opid", expYearField.opid, someTestValue]);
      });

      it("returns an expiration year parsed from the select options if the value of an option contains only two characters and the vault item value contains four characters", () => {
        const yearValue = "26";
        expYearField.selectInfo.options.push(["The year 2026", yearValue]);
        options.cipher.card.expYear = "2026";

        const value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.script[2]).toStrictEqual(["fill_by_opid", expYearField.opid, yearValue]);
      });

      it("returns an expiration year parsed from the select options if the vault of an option is separated by a colon", () => {
        const yearValue = "26";
        const colonSeparatedYearValue = `2:0${yearValue}`;
        expYearField.selectInfo.options.push(["The year 2026", colonSeparatedYearValue]);
        options.cipher.card.expYear = yearValue;

        const value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.script[2]).toStrictEqual([
          "fill_by_opid",
          expYearField.opid,
          colonSeparatedYearValue,
        ]);
      });

      it("returns an expiration year with `20` prepended to the vault item value if the field to be filled expects a `yyyy` format but the vault item only has two characters", () => {
        const yearValue = "26";
        expYearField.selectInfo = null;
        expYearField.placeholder = "yyyy";
        expYearField.maxLength = 4;
        options.cipher.card.expYear = yearValue;

        const value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.script[2]).toStrictEqual([
          "fill_by_opid",
          expYearField.opid,
          `20${yearValue}`,
        ]);
      });

      it("returns an expiration year with only the last two values if the field to be filled expects a `yy` format but the vault item contains four characters", () => {
        const yearValue = "26";
        expYearField.selectInfo = null;
        expYearField.placeholder = "yy";
        expYearField.maxLength = 2;
        options.cipher.card.expYear = `20${yearValue}`;

        const value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.script[2]).toStrictEqual(["fill_by_opid", expYearField.opid, yearValue]);
      });
    });

    describe("given a generic expiration date field", () => {
      let expirationDateField: AutofillField;
      let expirationDateFieldView: FieldView;

      beforeEach(() => {
        expirationDateField = createAutofillFieldMock({
          opid: "expirationDate",
          form: "validFormId",
          elementNumber: 3,
          htmlName: "expiration-date",
        });
        filledFields["exp-field"] = expirationDateField;
        expirationDateFieldView = mock<FieldView>({ name: "exp" });
        pageDetails.fields = [expirationDateField];
        options.cipher.fields = [expirationDateFieldView];
        options.cipher.card.expMonth = "05";
        options.cipher.card.expYear = "2024";
      });

      const expectedDateFormats = [
        ["mm/yyyy", "05/2024"],
        ["mm/yy", "05/24"],
        ["yyyy/mm", "2024/05"],
        ["yy/mm", "24/05"],
        ["mm-yyyy", "05-2024"],
        ["mm-yy", "05-24"],
        ["yyyy-mm", "2024-05"],
        ["yy-mm", "24-05"],
        ["yyyymm", "202405"],
        ["yymm", "2405"],
        ["mmyyyy", "052024"],
        ["mmyy", "0524"],
      ];
      expectedDateFormats.forEach((dateFormat, index) => {
        it(`returns an expiration date format matching '${dateFormat[0]}'`, () => {
          expirationDateField.placeholder = dateFormat[0];
          if (index === 0) {
            options.cipher.card.expYear = "24";
          }
          if (index === 1) {
            options.cipher.card.expMonth = "5";
          }

          const value = autofillService["generateCardFillScript"](
            fillScript,
            pageDetails,
            filledFields,
            options
          );

          expect(value.script[2]).toStrictEqual(["fill_by_opid", "expirationDate", dateFormat[1]]);
        });
      });

      it("returns an expiration date format matching `yyyy-mm` if no valid format can be identified", () => {
        const value = autofillService["generateCardFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(value.script[2]).toStrictEqual(["fill_by_opid", "expirationDate", "2024-05"]);
      });
    });
  });

  describe("inUntrustedIframe", () => {
    it("returns a false value if the passed pageUrl is equal to the options tabUrl", () => {
      const pageUrl = "https://www.example.com";
      const tabUrl = "https://www.example.com";
      const generateFillScriptOptions = createGenerateFillScriptOptionsMock({ tabUrl });
      generateFillScriptOptions.cipher.login.matchesUri = jest.fn().mockReturnValueOnce(true);
      jest.spyOn(settingsService, "getEquivalentDomains");

      const result = autofillService["inUntrustedIframe"](pageUrl, generateFillScriptOptions);

      expect(settingsService.getEquivalentDomains).not.toHaveBeenCalled();
      expect(generateFillScriptOptions.cipher.login.matchesUri).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("returns a false value if the passed pageUrl matches the domain of the tabUrl", () => {
      const pageUrl = "https://subdomain.example.com";
      const tabUrl = "https://www.example.com";
      const equivalentDomains = new Set(["example.com"]);
      const generateFillScriptOptions = createGenerateFillScriptOptionsMock({ tabUrl });
      generateFillScriptOptions.cipher.login.matchesUri = jest.fn().mockReturnValueOnce(true);
      jest.spyOn(settingsService as any, "getEquivalentDomains").mockReturnValue(equivalentDomains);

      const result = autofillService["inUntrustedIframe"](pageUrl, generateFillScriptOptions);

      expect(settingsService.getEquivalentDomains).toHaveBeenCalledWith(pageUrl);
      expect(generateFillScriptOptions.cipher.login.matchesUri).toHaveBeenCalledWith(
        pageUrl,
        equivalentDomains,
        generateFillScriptOptions.defaultUriMatch
      );
      expect(result).toBe(false);
    });

    it("returns a true value if the passed pageUrl does not match the domain of the tabUrl", () => {
      const pageUrl = "https://subdomain.example.com";
      const tabUrl = "https://www.not-example.com";
      const equivalentDomains = new Set(["not-example.com"]);
      const generateFillScriptOptions = createGenerateFillScriptOptionsMock({ tabUrl });
      generateFillScriptOptions.cipher.login.matchesUri = jest.fn().mockReturnValueOnce(false);
      jest.spyOn(settingsService as any, "getEquivalentDomains").mockReturnValue(equivalentDomains);

      const result = autofillService["inUntrustedIframe"](pageUrl, generateFillScriptOptions);

      expect(settingsService.getEquivalentDomains).toHaveBeenCalledWith(pageUrl);
      expect(generateFillScriptOptions.cipher.login.matchesUri).toHaveBeenCalledWith(
        pageUrl,
        equivalentDomains,
        generateFillScriptOptions.defaultUriMatch
      );
      expect(result).toBe(true);
    });
  });

  describe("fieldAttrsContain", () => {
    let cardNumberField: AutofillField;

    beforeEach(() => {
      cardNumberField = createAutofillFieldMock({
        opid: "cardNumber",
        form: "validFormId",
        elementNumber: 1,
        htmlName: "card-number",
      });
    });

    it("returns false if a field is not passed", () => {
      const value = autofillService["fieldAttrsContain"](null, "data-foo");

      expect(value).toBe(false);
    });

    it("returns false if the field does not contain the passed attribute", () => {
      const value = autofillService["fieldAttrsContain"](cardNumberField, "data-foo");

      expect(value).toBe(false);
    });

    it("returns true if the field contains the passed attribute", () => {
      const value = autofillService["fieldAttrsContain"](cardNumberField, "card-number");

      expect(value).toBe(true);
    });
  });

  describe("generateIdentityFillScript", () => {
    let fillScript: AutofillScript;
    let pageDetails: AutofillPageDetails;
    let filledFields: { [id: string]: AutofillField };
    let options: GenerateFillScriptOptions;

    beforeEach(() => {
      fillScript = createAutofillScriptMock({ script: [] });
      pageDetails = createAutofillPageDetailsMock();
      filledFields = {};
      options = createGenerateFillScriptOptionsMock();
      options.cipher.identity = mock<IdentityView>();
    });

    it("returns null if an identify is not found within the cipher", () => {
      options.cipher.identity = null;
      jest.spyOn(autofillService as any, "makeScriptAction");
      jest.spyOn(autofillService as any, "makeScriptActionWithValue");

      const value = autofillService["generateIdentityFillScript"](
        fillScript,
        pageDetails,
        filledFields,
        options
      );

      expect(value).toBeNull();
      expect(autofillService["makeScriptAction"]).not.toHaveBeenCalled();
      expect(autofillService["makeScriptActionWithValue"]).not.toHaveBeenCalled();
    });

    describe("given a set of page details that contains fields", () => {
      const firstName = "John";
      const middleName = "A";
      const lastName = "Doe";

      beforeEach(() => {
        pageDetails.fields = [];
        jest.spyOn(AutofillService, "forCustomFieldsOnly");
        jest.spyOn(autofillService as any, "isExcludedType");
        jest.spyOn(AutofillService as any, "isFieldMatch");
        jest.spyOn(autofillService as any, "makeScriptAction");
        jest.spyOn(autofillService as any, "makeScriptActionWithValue");
      });

      it("will not attempt to match custom fields", () => {
        const customField = createAutofillFieldMock({ tagName: "span" });
        pageDetails.fields.push(customField);

        const value = autofillService["generateIdentityFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(AutofillService.forCustomFieldsOnly).toHaveBeenCalledWith(customField);
        expect(autofillService["isExcludedType"]).not.toHaveBeenCalled();
        expect(AutofillService["isFieldMatch"]).not.toHaveBeenCalled();
        expect(value.script).toStrictEqual([]);
      });

      it("will not attempt to match a field that is of an excluded type", () => {
        const excludedField = createAutofillFieldMock({ type: "hidden" });
        pageDetails.fields.push(excludedField);

        const value = autofillService["generateIdentityFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(AutofillService.forCustomFieldsOnly).toHaveBeenCalledWith(excludedField);
        expect(autofillService["isExcludedType"]).toHaveBeenCalledWith(
          excludedField.type,
          AutoFillConstants.ExcludedAutofillTypes
        );
        expect(AutofillService["isFieldMatch"]).not.toHaveBeenCalled();
        expect(value.script).toStrictEqual([]);
      });

      it("will not attempt to match a field that is not viewable", () => {
        const viewableField = createAutofillFieldMock({ viewable: false });
        pageDetails.fields.push(viewableField);

        const value = autofillService["generateIdentityFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(AutofillService.forCustomFieldsOnly).toHaveBeenCalledWith(viewableField);
        expect(autofillService["isExcludedType"]).toHaveBeenCalled();
        expect(AutofillService["isFieldMatch"]).not.toHaveBeenCalled();
        expect(value.script).toStrictEqual([]);
      });

      it("will match a full name field to the vault item identity value", () => {
        const fullNameField = createAutofillFieldMock({ opid: "fullName", htmlName: "full-name" });
        pageDetails.fields = [fullNameField];
        options.cipher.identity.firstName = firstName;
        options.cipher.identity.middleName = middleName;
        options.cipher.identity.lastName = lastName;

        const value = autofillService["generateIdentityFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          fullNameField.htmlName,
          IdentityAutoFillConstants.FullNameFieldNames,
          IdentityAutoFillConstants.FullNameFieldNameValues
        );
        expect(autofillService["makeScriptActionWithValue"]).toHaveBeenCalledWith(
          fillScript,
          `${firstName} ${middleName} ${lastName}`,
          fullNameField,
          filledFields
        );
        expect(value.script[2]).toStrictEqual([
          "fill_by_opid",
          fullNameField.opid,
          `${firstName} ${middleName} ${lastName}`,
        ]);
      });

      it("will match a full name field to the a vault item that only has a last name", () => {
        const fullNameField = createAutofillFieldMock({ opid: "fullName", htmlName: "full-name" });
        pageDetails.fields = [fullNameField];
        options.cipher.identity.firstName = "";
        options.cipher.identity.middleName = "";
        options.cipher.identity.lastName = lastName;

        const value = autofillService["generateIdentityFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          fullNameField.htmlName,
          IdentityAutoFillConstants.FullNameFieldNames,
          IdentityAutoFillConstants.FullNameFieldNameValues
        );
        expect(autofillService["makeScriptActionWithValue"]).toHaveBeenCalledWith(
          fillScript,
          lastName,
          fullNameField,
          filledFields
        );
        expect(value.script[2]).toStrictEqual(["fill_by_opid", fullNameField.opid, lastName]);
      });

      it("will match first name, middle name, and last name fields to the vault item identity value", () => {
        const firstNameField = createAutofillFieldMock({
          opid: "firstName",
          htmlName: "first-name",
        });
        const middleNameField = createAutofillFieldMock({
          opid: "middleName",
          htmlName: "middle-name",
        });
        const lastNameField = createAutofillFieldMock({ opid: "lastName", htmlName: "last-name" });
        pageDetails.fields = [firstNameField, middleNameField, lastNameField];
        options.cipher.identity.firstName = firstName;
        options.cipher.identity.middleName = middleName;
        options.cipher.identity.lastName = lastName;

        const value = autofillService["generateIdentityFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          firstNameField.htmlName,
          IdentityAutoFillConstants.FirstnameFieldNames
        );
        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          middleNameField.htmlName,
          IdentityAutoFillConstants.MiddlenameFieldNames
        );
        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          lastNameField.htmlName,
          IdentityAutoFillConstants.LastnameFieldNames
        );
        expect(autofillService["makeScriptAction"]).toHaveBeenCalledWith(
          fillScript,
          options.cipher.identity,
          expect.anything(),
          filledFields,
          firstNameField.opid
        );
        expect(autofillService["makeScriptAction"]).toHaveBeenCalledWith(
          fillScript,
          options.cipher.identity,
          expect.anything(),
          filledFields,
          middleNameField.opid
        );
        expect(autofillService["makeScriptAction"]).toHaveBeenCalledWith(
          fillScript,
          options.cipher.identity,
          expect.anything(),
          filledFields,
          lastNameField.opid
        );
        expect(value.script[2]).toStrictEqual(["fill_by_opid", firstNameField.opid, firstName]);
        expect(value.script[5]).toStrictEqual(["fill_by_opid", middleNameField.opid, middleName]);
        expect(value.script[8]).toStrictEqual(["fill_by_opid", lastNameField.opid, lastName]);
      });

      it("will match title and email fields to the vault item identity value", () => {
        const titleField = createAutofillFieldMock({ opid: "title", htmlName: "title" });
        const emailField = createAutofillFieldMock({ opid: "email", htmlName: "email" });
        pageDetails.fields = [titleField, emailField];
        const title = "Mr.";
        const email = "email@example.com";
        options.cipher.identity.title = title;
        options.cipher.identity.email = email;

        const value = autofillService["generateIdentityFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          titleField.htmlName,
          IdentityAutoFillConstants.TitleFieldNames
        );
        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          emailField.htmlName,
          IdentityAutoFillConstants.EmailFieldNames
        );
        expect(autofillService["makeScriptAction"]).toHaveBeenCalledWith(
          fillScript,
          options.cipher.identity,
          expect.anything(),
          filledFields,
          titleField.opid
        );
        expect(autofillService["makeScriptAction"]).toHaveBeenCalledWith(
          fillScript,
          options.cipher.identity,
          expect.anything(),
          filledFields,
          emailField.opid
        );
        expect(value.script[2]).toStrictEqual(["fill_by_opid", titleField.opid, title]);
        expect(value.script[5]).toStrictEqual(["fill_by_opid", emailField.opid, email]);
      });

      it("will match a full address field to the vault item identity values", () => {
        const fullAddressField = createAutofillFieldMock({
          opid: "fullAddress",
          htmlName: "address",
        });
        pageDetails.fields = [fullAddressField];
        const address1 = "123 Main St.";
        const address2 = "Apt. 1";
        const address3 = "P.O. Box 123";
        options.cipher.identity.address1 = address1;
        options.cipher.identity.address2 = address2;
        options.cipher.identity.address3 = address3;

        const value = autofillService["generateIdentityFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          fullAddressField.htmlName,
          IdentityAutoFillConstants.AddressFieldNames,
          IdentityAutoFillConstants.AddressFieldNameValues
        );
        expect(autofillService["makeScriptActionWithValue"]).toHaveBeenCalledWith(
          fillScript,
          `${address1}, ${address2}, ${address3}`,
          fullAddressField,
          filledFields
        );
        expect(value.script[2]).toStrictEqual([
          "fill_by_opid",
          fullAddressField.opid,
          `${address1}, ${address2}, ${address3}`,
        ]);
      });

      it("will match address1, address2, address3, postalCode, city, state, country, phone, username, and company fields to their corresponding vault item identity values", () => {
        const address1Field = createAutofillFieldMock({ opid: "address1", htmlName: "address-1" });
        const address2Field = createAutofillFieldMock({ opid: "address2", htmlName: "address-2" });
        const address3Field = createAutofillFieldMock({ opid: "address3", htmlName: "address-3" });
        const postalCodeField = createAutofillFieldMock({
          opid: "postalCode",
          htmlName: "postal-code",
        });
        const cityField = createAutofillFieldMock({ opid: "city", htmlName: "city" });
        const stateField = createAutofillFieldMock({ opid: "state", htmlName: "state" });
        const countryField = createAutofillFieldMock({ opid: "country", htmlName: "country" });
        const phoneField = createAutofillFieldMock({ opid: "phone", htmlName: "phone" });
        const usernameField = createAutofillFieldMock({ opid: "username", htmlName: "username" });
        const companyField = createAutofillFieldMock({ opid: "company", htmlName: "company" });
        pageDetails.fields = [
          address1Field,
          address2Field,
          address3Field,
          postalCodeField,
          cityField,
          stateField,
          countryField,
          phoneField,
          usernameField,
          companyField,
        ];
        const address1 = "123 Main St.";
        const address2 = "Apt. 1";
        const address3 = "P.O. Box 123";
        const postalCode = "12345";
        const city = "City";
        const state = "State";
        const country = "Country";
        const phone = "123-456-7890";
        const username = "username";
        const company = "Company";
        options.cipher.identity.address1 = address1;
        options.cipher.identity.address2 = address2;
        options.cipher.identity.address3 = address3;
        options.cipher.identity.postalCode = postalCode;
        options.cipher.identity.city = city;
        options.cipher.identity.state = state;
        options.cipher.identity.country = country;
        options.cipher.identity.phone = phone;
        options.cipher.identity.username = username;
        options.cipher.identity.company = company;

        const value = autofillService["generateIdentityFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          address1Field.htmlName,
          IdentityAutoFillConstants.Address1FieldNames
        );
        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          address2Field.htmlName,
          IdentityAutoFillConstants.Address2FieldNames
        );
        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          address3Field.htmlName,
          IdentityAutoFillConstants.Address3FieldNames
        );
        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          postalCodeField.htmlName,
          IdentityAutoFillConstants.PostalCodeFieldNames
        );
        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          cityField.htmlName,
          IdentityAutoFillConstants.CityFieldNames
        );
        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          stateField.htmlName,
          IdentityAutoFillConstants.StateFieldNames
        );
        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          countryField.htmlName,
          IdentityAutoFillConstants.CountryFieldNames
        );
        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          phoneField.htmlName,
          IdentityAutoFillConstants.PhoneFieldNames
        );
        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          usernameField.htmlName,
          IdentityAutoFillConstants.UserNameFieldNames
        );
        expect(AutofillService["isFieldMatch"]).toHaveBeenCalledWith(
          companyField.htmlName,
          IdentityAutoFillConstants.CompanyFieldNames
        );
        expect(autofillService["makeScriptAction"]).toHaveBeenCalled();
        expect(value.script[2]).toStrictEqual(["fill_by_opid", address1Field.opid, address1]);
        expect(value.script[5]).toStrictEqual(["fill_by_opid", address2Field.opid, address2]);
        expect(value.script[8]).toStrictEqual(["fill_by_opid", address3Field.opid, address3]);
        expect(value.script[11]).toStrictEqual(["fill_by_opid", cityField.opid, city]);
        expect(value.script[14]).toStrictEqual(["fill_by_opid", postalCodeField.opid, postalCode]);
        expect(value.script[17]).toStrictEqual(["fill_by_opid", companyField.opid, company]);
        expect(value.script[20]).toStrictEqual(["fill_by_opid", phoneField.opid, phone]);
        expect(value.script[23]).toStrictEqual(["fill_by_opid", usernameField.opid, username]);
        expect(value.script[26]).toStrictEqual(["fill_by_opid", stateField.opid, state]);
        expect(value.script[29]).toStrictEqual(["fill_by_opid", countryField.opid, country]);
      });

      it("will find the two character IsoState value for an identity cipher that contains the full name of a state", () => {
        const stateField = createAutofillFieldMock({ opid: "state", htmlName: "state" });
        pageDetails.fields = [stateField];
        const state = "California";
        options.cipher.identity.state = state;

        const value = autofillService["generateIdentityFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(autofillService["makeScriptActionWithValue"]).toHaveBeenCalledWith(
          fillScript,
          "CA",
          expect.anything(),
          expect.anything()
        );
        expect(value.script[2]).toStrictEqual(["fill_by_opid", stateField.opid, "CA"]);
      });

      it("will find the two character IsoProvince value for an identity cipher that contains the full name of a province", () => {
        const stateField = createAutofillFieldMock({ opid: "state", htmlName: "state" });
        pageDetails.fields = [stateField];
        const state = "Ontario";
        options.cipher.identity.state = state;

        const value = autofillService["generateIdentityFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(autofillService["makeScriptActionWithValue"]).toHaveBeenCalledWith(
          fillScript,
          "ON",
          expect.anything(),
          expect.anything()
        );
        expect(value.script[2]).toStrictEqual(["fill_by_opid", stateField.opid, "ON"]);
      });

      it("will find the two character IsoCountry value for an identity cipher that contains the full name of a country", () => {
        const countryField = createAutofillFieldMock({ opid: "country", htmlName: "country" });
        pageDetails.fields = [countryField];
        const country = "Somalia";
        options.cipher.identity.country = country;

        const value = autofillService["generateIdentityFillScript"](
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        expect(autofillService["makeScriptActionWithValue"]).toHaveBeenCalledWith(
          fillScript,
          "SO",
          expect.anything(),
          expect.anything()
        );
        expect(value.script[2]).toStrictEqual(["fill_by_opid", countryField.opid, "SO"]);
      });
    });
  });

  describe("isExcludedType", () => {
    it("returns true if the passed type is within the excluded type list", () => {
      const value = autofillService["isExcludedType"](
        "hidden",
        AutoFillConstants.ExcludedAutofillTypes
      );

      expect(value).toBe(true);
    });

    it("returns true if the passed type is within the excluded type list", () => {
      const value = autofillService["isExcludedType"](
        "text",
        AutoFillConstants.ExcludedAutofillTypes
      );

      expect(value).toBe(false);
    });
  });

  describe("isFieldMatch", () => {
    it("returns true if the passed value is equal to one of the values in the passed options list", () => {
      const passedAttribute = "cc-name";
      const passedOptions = ["cc-name", "cc_full_name"];

      const value = AutofillService["isFieldMatch"](passedAttribute, passedOptions);

      expect(value).toBe(true);
    });

    it("should returns true if the passed options contain a value within the containsOptions list and the passed value partial matches the option", () => {
      const passedAttribute = "cc-name-full";
      const passedOptions = ["cc-name", "cc_full_name"];
      const containsOptions = ["cc-name"];

      const value = AutofillService["isFieldMatch"](
        passedAttribute,
        passedOptions,
        containsOptions
      );

      expect(value).toBe(true);
    });

    it("returns false if the value is not a partial match to an option found within the containsOption list", () => {
      const passedAttribute = "cc-full-name";
      const passedOptions = ["cc-name", "cc_full_name"];
      const containsOptions = ["cc-name"];

      const value = AutofillService["isFieldMatch"](
        passedAttribute,
        passedOptions,
        containsOptions
      );

      expect(value).toBe(false);
    });
  });

  describe("makeScriptAction", () => {
    let fillScript: AutofillScript;
    let options: GenerateFillScriptOptions;
    let mockLoginView: any;
    let fillFields: { [key: string]: AutofillField };
    const filledFields = {};

    beforeEach(() => {
      fillScript = createAutofillScriptMock({});
      options = createGenerateFillScriptOptionsMock({});
      mockLoginView = mock<LoginView>() as any;
      options.cipher.login = mockLoginView;
      fillFields = {
        "username-field": createAutofillFieldMock({ opid: "username-field" }),
      };
      jest.spyOn(autofillService as any, "makeScriptActionWithValue");
    });

    it("makes a call to makeScriptActionWithValue using the passed dataProp value", () => {
      const dataProp = "username-field";

      autofillService["makeScriptAction"](
        fillScript,
        options.cipher.login,
        fillFields,
        filledFields,
        dataProp
      );

      expect(autofillService["makeScriptActionWithValue"]).toHaveBeenCalledWith(
        fillScript,
        mockLoginView[dataProp],
        fillFields[dataProp],
        filledFields
      );
    });

    it("makes a call to makeScriptActionWithValue using the passed fieldProp value used for fillFields", () => {
      const dataProp = "value";
      const fieldProp = "username-field";

      autofillService["makeScriptAction"](
        fillScript,
        options.cipher.login,
        fillFields,
        filledFields,
        dataProp,
        fieldProp
      );

      expect(autofillService["makeScriptActionWithValue"]).toHaveBeenCalledWith(
        fillScript,
        mockLoginView[dataProp],
        fillFields[fieldProp],
        filledFields
      );
    });
  });

  describe("makeScriptActionWithValue", () => {
    let fillScript: AutofillScript;
    let options: GenerateFillScriptOptions;
    let mockLoginView: any;
    let fillFields: { [key: string]: AutofillField };
    const filledFields = {};

    beforeEach(() => {
      fillScript = createAutofillScriptMock({});
      options = createGenerateFillScriptOptionsMock({});
      mockLoginView = mock<LoginView>() as any;
      options.cipher.login = mockLoginView;
      fillFields = {
        "username-field": createAutofillFieldMock({ opid: "username-field" }),
      };
      jest.spyOn(autofillService as any, "makeScriptActionWithValue");
      jest.spyOn(AutofillService, "hasValue");
      jest.spyOn(AutofillService, "fillByOpid");
    });

    it("will not add an autofill action to the fill script if the value does not exist", () => {
      const dataValue = "";

      autofillService["makeScriptActionWithValue"](
        fillScript,
        dataValue,
        fillFields["username-field"],
        filledFields
      );

      expect(AutofillService.hasValue).toHaveBeenCalledWith(dataValue);
      expect(AutofillService.fillByOpid).not.toHaveBeenCalled();
    });

    it("will not add an autofill action to the fill script if a field is not passed", () => {
      const dataValue = "username";

      autofillService["makeScriptActionWithValue"](fillScript, dataValue, null, filledFields);

      expect(AutofillService.hasValue).toHaveBeenCalledWith(dataValue);
      expect(AutofillService.fillByOpid).not.toHaveBeenCalled();
    });

    it("will add an autofill action to the fill script", () => {
      const dataValue = "username";

      autofillService["makeScriptActionWithValue"](
        fillScript,
        dataValue,
        fillFields["username-field"],
        filledFields
      );

      expect(AutofillService.hasValue).toHaveBeenCalledWith(dataValue);
      expect(AutofillService.fillByOpid).toHaveBeenCalledWith(
        fillScript,
        fillFields["username-field"],
        dataValue
      );
    });

    describe("given a autofill field value that indicates the field is a `select` input", () => {
      it("will not add an autofil action to the fill script if the dataValue cannot be found in the select options", () => {
        const dataValue = "username";
        const selectField = createAutofillFieldMock({
          opid: "username-field",
          tagName: "select",
          type: "select-one",
          selectInfo: {
            options: [["User Name", "Some Other Username Value"]],
          },
        });

        autofillService["makeScriptActionWithValue"](
          fillScript,
          dataValue,
          selectField,
          filledFields
        );

        expect(AutofillService.hasValue).toHaveBeenCalledWith(dataValue);
        expect(AutofillService.fillByOpid).not.toHaveBeenCalled();
      });

      it("will update the data value to the value found in the select options, and add an autofill action to the fill script", () => {
        const dataValue = "username";
        const selectField = createAutofillFieldMock({
          opid: "username-field",
          tagName: "select",
          type: "select-one",
          selectInfo: {
            options: [["username", "Some Other Username Value"]],
          },
        });

        autofillService["makeScriptActionWithValue"](
          fillScript,
          dataValue,
          selectField,
          filledFields
        );

        expect(AutofillService.hasValue).toHaveBeenCalledWith(dataValue);
        expect(AutofillService.fillByOpid).toHaveBeenCalledWith(
          fillScript,
          selectField,
          "Some Other Username Value"
        );
      });
    });
  });

  describe("loadPasswordFields", () => {
    let pageDetails: AutofillPageDetails;
    let passwordField: AutofillField;

    beforeEach(() => {
      pageDetails = createAutofillPageDetailsMock({});
      passwordField = createAutofillFieldMock({
        opid: "password-field",
        type: "password",
        form: "validFormId",
      });
      jest.spyOn(AutofillService, "forCustomFieldsOnly");
    });

    it("returns an empty array if passed a field that is a `span` element", () => {
      const customField = createAutofillFieldMock({ tagName: "span" });
      pageDetails.fields = [customField];

      const result = AutofillService.loadPasswordFields(pageDetails, false, false, false, false);

      expect(AutofillService.forCustomFieldsOnly).toHaveBeenCalledWith(customField);
      expect(result).toStrictEqual([]);
    });

    it("returns an empty array if passed a disabled field", () => {
      passwordField.disabled = true;
      pageDetails.fields = [passwordField];

      const result = AutofillService.loadPasswordFields(pageDetails, false, false, false, false);

      expect(result).toStrictEqual([]);
    });

    describe("given a field that is readonly", () => {
      it("returns an empty array if the field cannot be readonly", () => {
        passwordField.readonly = true;
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, false, false);

        expect(result).toStrictEqual([]);
      });

      it("returns the field within an array if the field can be readonly", () => {
        passwordField.readonly = true;
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, true, false, true);

        expect(result).toStrictEqual([passwordField]);
      });
    });

    describe("give a field that is not of type `password`", () => {
      beforeEach(() => {
        passwordField.type = "text";
      });

      it("returns an empty array if the field type is not `text`", () => {
        passwordField.type = "email";
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, false, false);

        expect(result).toStrictEqual([]);
      });

      it("returns an empty array if the `htmlID`, `htmlName`, or `placeholder` of the field's values do not include the word `password`", () => {
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, false, false);

        expect(result).toStrictEqual([]);
      });

      it("returns an empty array if the `htmlID` of the field is `null", () => {
        passwordField.htmlID = null;
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, false, false);

        expect(result).toStrictEqual([]);
      });

      it("returns an empty array if the `htmlID` of the field is equal to `onetimepassword`", () => {
        passwordField.htmlID = "onetimepassword";
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, false, false);

        expect(result).toStrictEqual([]);
      });

      it("returns the field in an array if the field's htmlID contains the word `password`", () => {
        passwordField.htmlID = "password";
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, false, false);

        expect(result).toStrictEqual([passwordField]);
      });

      it("returns the field in an array if the field's htmlName contains the word `password`", () => {
        passwordField.htmlName = "password";
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, false, false);

        expect(result).toStrictEqual([passwordField]);
      });

      it("returns the field in an array if the field's placeholder contains the word `password`", () => {
        passwordField.placeholder = "password";
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, false, false);

        expect(result).toStrictEqual([passwordField]);
      });
    });

    describe("given a field that is not viewable", () => {
      it("returns an empty array if the field cannot be hidden", () => {
        passwordField.viewable = false;
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, false, false);

        expect(result).toStrictEqual([]);
      });

      it("returns the field within an array if the field can be hidden", () => {
        passwordField.viewable = false;
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, true, false, false, true);

        expect(result).toStrictEqual([passwordField]);
      });
    });

    describe("given a need for the passed to be empty", () => {
      it("returns an empty array if the passed field contains a value that is not null or empty", () => {
        passwordField.value = "Some Password Value";
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, true, false);

        expect(result).toStrictEqual([]);
      });

      it("returns the field within an array if the field contains a null value", () => {
        passwordField.value = null;
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, true, false);

        expect(result).toStrictEqual([passwordField]);
      });

      it("returns the field within an array if the field contains an empty value", () => {
        passwordField.value = "";
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, true, false);

        expect(result).toStrictEqual([passwordField]);
      });
    });

    describe("given a field with a new password", () => {
      beforeEach(() => {
        passwordField.autoCompleteType = "new-password";
      });

      it("returns an empty array if not filling a new password and the autoCompleteType is `new-password`", () => {
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, false, false);

        expect(result).toStrictEqual([]);
      });

      it("returns the field within an array if filling a new password and the autoCompleteType is `new-password`", () => {
        pageDetails.fields = [passwordField];

        const result = AutofillService.loadPasswordFields(pageDetails, false, false, false, true);

        expect(result).toStrictEqual([passwordField]);
      });
    });
  });

  describe("findUsernameField", () => {
    let pageDetails: AutofillPageDetails;
    let usernameField: AutofillField;
    let passwordField: AutofillField;

    beforeEach(() => {
      pageDetails = createAutofillPageDetailsMock({});
      usernameField = createAutofillFieldMock({
        opid: "username-field",
        type: "text",
        form: "validFormId",
        elementNumber: 0,
      });
      passwordField = createAutofillFieldMock({
        opid: "password-field",
        type: "password",
        form: "validFormId",
        elementNumber: 1,
      });
      pageDetails.fields = [usernameField, passwordField];
      jest.spyOn(AutofillService, "forCustomFieldsOnly");
      jest.spyOn(autofillService as any, "findMatchingFieldIndex");
    });

    it("returns null when passed a field that is a `span` element", () => {
      const field = createAutofillFieldMock({ tagName: "span" });
      pageDetails.fields = [field];

      const result = autofillService["findUsernameField"](pageDetails, field, false, false, false);

      expect(AutofillService.forCustomFieldsOnly).toHaveBeenCalledWith(field);
      expect(result).toBe(null);
    });

    it("returns null when the passed username field has a larger elementNumber than the passed password field", () => {
      usernameField.elementNumber = 2;

      const result = autofillService["findUsernameField"](
        pageDetails,
        passwordField,
        false,
        false,
        false
      );

      expect(result).toBe(null);
    });

    it("returns null if the passed username field is disabled", () => {
      usernameField.disabled = true;

      const result = autofillService["findUsernameField"](
        pageDetails,
        passwordField,
        false,
        false,
        false
      );

      expect(result).toBe(null);
    });

    describe("given a field that is readonly", () => {
      beforeEach(() => {
        usernameField.readonly = true;
      });

      it("returns null if the field cannot be readonly", () => {
        const result = autofillService["findUsernameField"](
          pageDetails,
          passwordField,
          false,
          false,
          false
        );

        expect(result).toBe(null);
      });

      it("returns the field if the field can be readonly", () => {
        const result = autofillService["findUsernameField"](
          pageDetails,
          passwordField,
          false,
          true,
          false
        );

        expect(result).toBe(usernameField);
      });
    });

    describe("given a username field that does not contain a form that matches the password field", () => {
      beforeEach(() => {
        usernameField.form = "invalidFormId";
        usernameField.type = "tel";
      });

      it("returns null if the field cannot be without a form", () => {
        const result = autofillService["findUsernameField"](
          pageDetails,
          passwordField,
          false,
          false,
          false
        );

        expect(result).toBe(null);
      });

      it("returns the field if the username field can be without a form", () => {
        const result = autofillService["findUsernameField"](
          pageDetails,
          passwordField,
          false,
          false,
          true
        );

        expect(result).toBe(usernameField);
      });
    });

    describe("given a field that is not viewable", () => {
      beforeEach(() => {
        usernameField.viewable = false;
        usernameField.type = "email";
      });

      it("returns null if the field cannot be hidden", () => {
        const result = autofillService["findUsernameField"](
          pageDetails,
          passwordField,
          false,
          false,
          false
        );

        expect(result).toBe(null);
      });

      it("returns the field if the field can be hidden", () => {
        const result = autofillService["findUsernameField"](
          pageDetails,
          passwordField,
          true,
          false,
          false
        );

        expect(result).toBe(usernameField);
      });
    });

    it("returns null if the username field does not have a type of `text`, `email`, or `tel`", () => {
      usernameField.type = "checkbox";

      const result = autofillService["findUsernameField"](
        pageDetails,
        passwordField,
        false,
        false,
        false
      );

      expect(result).toBe(null);
    });

    it("returns the username field whose attributes most closely describe the username of the password field", () => {
      const usernameField2 = createAutofillFieldMock({
        opid: "username-field-2",
        type: "text",
        form: "validFormId",
        htmlName: "username",
        elementNumber: 1,
      });
      const usernameField3 = createAutofillFieldMock({
        opid: "username-field-3",
        type: "text",
        form: "validFormId",
        elementNumber: 1,
      });
      passwordField.elementNumber = 3;
      pageDetails.fields = [usernameField, usernameField2, usernameField3, passwordField];

      const result = autofillService["findUsernameField"](
        pageDetails,
        passwordField,
        false,
        false,
        false
      );

      expect(result).toBe(usernameField2);
      expect(autofillService["findMatchingFieldIndex"]).toHaveBeenCalledTimes(2);
      expect(autofillService["findMatchingFieldIndex"]).not.toHaveBeenCalledWith(
        usernameField3,
        AutoFillConstants.UsernameFieldNames
      );
    });
  });

  describe("findTotpField", () => {
    let pageDetails: AutofillPageDetails;
    let passwordField: AutofillField;
    let totpField: AutofillField;

    beforeEach(() => {
      pageDetails = createAutofillPageDetailsMock({});
      passwordField = createAutofillFieldMock({
        opid: "password-field",
        type: "password",
        form: "validFormId",
        elementNumber: 0,
      });
      totpField = createAutofillFieldMock({
        opid: "totp-field",
        type: "text",
        form: "validFormId",
        htmlName: "totp",
        elementNumber: 1,
      });
      pageDetails.fields = [passwordField, totpField];
      jest.spyOn(AutofillService, "forCustomFieldsOnly");
      jest.spyOn(autofillService as any, "findMatchingFieldIndex");
      jest.spyOn(AutofillService, "fieldIsFuzzyMatch");
    });

    it("returns null when passed a field that is a `span` element", () => {
      const field = createAutofillFieldMock({ tagName: "span" });
      pageDetails.fields = [field];

      const result = autofillService["findTotpField"](pageDetails, field, false, false, false);

      expect(AutofillService.forCustomFieldsOnly).toHaveBeenCalledWith(field);
      expect(result).toBe(null);
    });

    it("returns null if the passed totp field is disabled", () => {
      totpField.disabled = true;

      const result = autofillService["findTotpField"](
        pageDetails,
        passwordField,
        false,
        false,
        false
      );

      expect(result).toBe(null);
    });

    describe("given a field that is readonly", () => {
      beforeEach(() => {
        totpField.readonly = true;
      });

      it("returns null if the field cannot be readonly", () => {
        const result = autofillService["findTotpField"](
          pageDetails,
          passwordField,
          false,
          false,
          false
        );

        expect(result).toBe(null);
      });

      it("returns the field if the field can be readonly", () => {
        const result = autofillService["findTotpField"](
          pageDetails,
          passwordField,
          false,
          true,
          false
        );

        expect(result).toBe(totpField);
      });
    });

    describe("given a totp field that does not contain a form that matches the password field", () => {
      beforeEach(() => {
        totpField.form = "invalidFormId";
      });

      it("returns null if the field cannot be without a form", () => {
        const result = autofillService["findTotpField"](
          pageDetails,
          passwordField,
          false,
          false,
          false
        );

        expect(result).toBe(null);
      });

      it("returns the field if the username field can be without a form", () => {
        const result = autofillService["findTotpField"](
          pageDetails,
          passwordField,
          false,
          false,
          true
        );

        expect(result).toBe(totpField);
      });
    });

    describe("given a field that is not viewable", () => {
      beforeEach(() => {
        totpField.viewable = false;
        totpField.type = "number";
      });

      it("returns null if the field cannot be hidden", () => {
        const result = autofillService["findTotpField"](
          pageDetails,
          passwordField,
          false,
          false,
          false
        );

        expect(result).toBe(null);
      });

      it("returns the field if the field can be hidden", () => {
        const result = autofillService["findTotpField"](
          pageDetails,
          passwordField,
          true,
          false,
          false
        );

        expect(result).toBe(totpField);
      });
    });

    it("returns null if the totp field does not have a type of `text`, or `number`", () => {
      totpField.type = "checkbox";

      const result = autofillService["findTotpField"](
        pageDetails,
        passwordField,
        false,
        false,
        false
      );

      expect(result).toBe(null);
    });

    it("returns the field if the autoCompleteType is `one-time-code`", () => {
      totpField.autoCompleteType = "one-time-code";
      jest.spyOn(autofillService as any, "findMatchingFieldIndex").mockReturnValueOnce(-1);

      const result = autofillService["findTotpField"](
        pageDetails,
        passwordField,
        false,
        false,
        false
      );

      expect(result).toBe(totpField);
    });
  });

  describe("findMatchingFieldIndex", () => {
    beforeEach(() => {
      jest.spyOn(autofillService as any, "fieldPropertyIsMatch");
    });

    it("returns the index of a value that matches a property prefix", () => {
      const attributes = [
        ["htmlID", "id"],
        ["htmlName", "name"],
        ["label-aria", "label"],
        ["label-tag", "label"],
        ["label-right", "label"],
        ["label-left", "label"],
        ["placeholder", "placeholder"],
      ];
      const value = "username";

      attributes.forEach((attribute) => {
        const field = createAutofillFieldMock({ [attribute[0]]: value });

        const result = autofillService["findMatchingFieldIndex"](field, [
          `${attribute[1]}=${value}`,
        ]);

        expect(autofillService["fieldPropertyIsMatch"]).toHaveBeenCalledWith(
          field,
          attribute[0],
          value
        );
        expect(result).toBe(0);
      });
    });

    it("returns the index of a value that matches a property", () => {
      const attributes = [
        "htmlID",
        "htmlName",
        "label-aria",
        "label-tag",
        "label-right",
        "label-left",
        "placeholder",
      ];
      const value = "username";

      attributes.forEach((attribute) => {
        const field = createAutofillFieldMock({ [attribute]: value });

        const result = autofillService["findMatchingFieldIndex"](field, [value]);

        expect(result).toBe(0);
      });
    });
  });

  describe("fieldPropertyIsPrefixMatch", () => {
    it("returns true if the field contains a property whose value is a match", () => {
      const field = createAutofillFieldMock({ htmlID: "username" });

      const result = autofillService["fieldPropertyIsPrefixMatch"](
        field,
        "htmlID",
        "id=username",
        "id"
      );

      expect(result).toBe(true);
    });

    it("returns false if the field contains a property whose value is not a match", () => {
      const field = createAutofillFieldMock({ htmlID: "username" });

      const result = autofillService["fieldPropertyIsPrefixMatch"](
        field,
        "htmlID",
        "id=some-othername",
        "id"
      );

      expect(result).toBe(false);
    });
  });

  describe("fieldPropertyIsMatch", () => {
    let field: AutofillField;

    beforeEach(() => {
      field = createAutofillFieldMock();
      jest.spyOn(AutofillService, "hasValue");
    });

    it("returns false if the property within the field does not have a value", () => {
      field.htmlID = "";

      const result = autofillService["fieldPropertyIsMatch"](field, "htmlID", "some-value");

      expect(AutofillService.hasValue).toHaveBeenCalledWith("");
      expect(result).toBe(false);
    });

    it("returns true if the property within the field provides a value that is equal to the passed `name`", () => {
      field.htmlID = "some-value";

      const result = autofillService["fieldPropertyIsMatch"](field, "htmlID", "some-value");

      expect(AutofillService.hasValue).toHaveBeenCalledWith("some-value");
      expect(result).toBe(true);
    });

    describe("given a passed `name` value that is expecting a regex check", () => {
      it("returns false if the property within the field fails the `name` regex check", () => {
        field.htmlID = "some-false-value";

        const result = autofillService["fieldPropertyIsMatch"](field, "htmlID", "regex=some-value");

        expect(result).toBe(false);
      });

      it("returns true if the property within the field equals the `name` regex check", () => {
        field.htmlID = "some-value";

        const result = autofillService["fieldPropertyIsMatch"](field, "htmlID", "regex=some-value");

        expect(result).toBe(true);
      });

      it("returns true if the property within the field has a partial match to the `name` regex check", () => {
        field.htmlID = "some-value";

        const result = autofillService["fieldPropertyIsMatch"](field, "htmlID", "regex=value");

        expect(result).toBe(true);
      });

      it("will log an error when the regex triggers a catch block", () => {
        field.htmlID = "some-value";
        jest.spyOn(autofillService["logService"], "error");

        const result = autofillService["fieldPropertyIsMatch"](field, "htmlID", "regex=+");

        expect(autofillService["logService"].error).toHaveBeenCalled();
        expect(result).toBe(false);
      });
    });

    describe("given a passed `name` value that is checking comma separated values", () => {
      it("returns false if the property within the field does not have a value that matches the values within the `name` CSV", () => {
        field.htmlID = "some-false-value";

        const result = autofillService["fieldPropertyIsMatch"](
          field,
          "htmlID",
          "csv=some-value,some-other-value,some-third-value"
        );

        expect(result).toBe(false);
      });

      it("returns true if the property within the field matches a value within the `name` CSV", () => {
        field.htmlID = "some-other-value";

        const result = autofillService["fieldPropertyIsMatch"](
          field,
          "htmlID",
          "csv=some-value,some-other-value,some-third-value"
        );

        expect(result).toBe(true);
      });
    });
  });

  describe("fieldIsFuzzyMatch", () => {
    let field: AutofillField;
    const fieldProperties = [
      "htmlID",
      "htmlName",
      "label-aria",
      "label-tag",
      "label-top",
      "label-left",
      "placeholder",
    ];

    beforeEach(() => {
      field = createAutofillFieldMock();
      jest.spyOn(AutofillService, "hasValue");
      jest.spyOn(AutofillService as any, "fuzzyMatch");
    });

    it("returns false if the field properties do not have any values", () => {
      fieldProperties.forEach((property) => {
        field[property] = "";
      });

      const result = AutofillService["fieldIsFuzzyMatch"](field, ["some-value"]);

      expect(AutofillService.hasValue).toHaveBeenCalledTimes(7);
      expect(AutofillService["fuzzyMatch"]).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("returns false if the field properties do not have a value that is a fuzzy match", () => {
      fieldProperties.forEach((property) => {
        field[property] = "some-false-value";

        const result = AutofillService["fieldIsFuzzyMatch"](field, ["some-value"]);

        expect(AutofillService.hasValue).toHaveBeenCalled();
        expect(AutofillService["fuzzyMatch"]).toHaveBeenCalledWith(
          ["some-value"],
          "some-false-value"
        );
        expect(result).toBe(false);

        field[property] = "";
      });
    });

    it("returns true if the field property has a value that is a fuzzy match", () => {
      fieldProperties.forEach((property) => {
        field[property] = "some-value";

        const result = AutofillService["fieldIsFuzzyMatch"](field, ["some-value"]);

        expect(AutofillService.hasValue).toHaveBeenCalled();
        expect(AutofillService["fuzzyMatch"]).toHaveBeenCalledWith(["some-value"], "some-value");
        expect(result).toBe(true);

        field[property] = "";
      });
    });
  });

  describe("fuzzyMatch", () => {
    it("returns false if the passed options is null", () => {
      const result = AutofillService["fuzzyMatch"](null, "some-value");

      expect(result).toBe(false);
    });

    it("returns false if the passed options contains an empty array", () => {
      const result = AutofillService["fuzzyMatch"]([], "some-value");

      expect(result).toBe(false);
    });

    it("returns false if the passed value is null", () => {
      const result = AutofillService["fuzzyMatch"](["some-value"], null);

      expect(result).toBe(false);
    });

    it("returns false if the passed value is an empty string", () => {
      const result = AutofillService["fuzzyMatch"](["some-value"], "");

      expect(result).toBe(false);
    });

    it("returns false if the passed value is not present in the options array", () => {
      const result = AutofillService["fuzzyMatch"](["some-value"], "some-other-value");

      expect(result).toBe(false);
    });

    it("returns true if the passed value is within the options array", () => {
      const result = AutofillService["fuzzyMatch"](
        ["some-other-value", "some-value"],
        "some-value"
      );

      expect(result).toBe(true);
    });
  });

  describe("hasValue", () => {
    it("returns false if the passed string is null", () => {
      const result = AutofillService.hasValue(null);

      expect(result).toBe(false);
    });

    it("returns false if the passed string is an empty string", () => {
      const result = AutofillService.hasValue("");

      expect(result).toBe(false);
    });

    it("returns true if the passed string is not null or an empty string", () => {
      const result = AutofillService.hasValue("some-value");

      expect(result).toBe(true);
    });
  });

  describe("setFillScriptForFocus", () => {
    let usernameField: AutofillField;
    let passwordField: AutofillField;
    let filledFields: { [key: string]: AutofillField };
    let fillScript: AutofillScript;

    beforeEach(() => {
      usernameField = createAutofillFieldMock({
        opid: "username-field",
        type: "text",
        form: "validFormId",
        elementNumber: 0,
      });
      passwordField = createAutofillFieldMock({
        opid: "password-field",
        type: "password",
        form: "validFormId",
        elementNumber: 1,
      });
      filledFields = {
        "username-field": usernameField,
        "password-field": passwordField,
      };
      fillScript = createAutofillScriptMock({ script: [] });
    });

    it("returns a fill script with an unmodified actions list if an empty filledFields value is passed", () => {
      const result = AutofillService.setFillScriptForFocus({}, fillScript);

      expect(result.script).toStrictEqual([]);
    });

    it("returns a fill script with the password field prioritized when adding a `focus_by_opid` action", () => {
      const result = AutofillService.setFillScriptForFocus(filledFields, fillScript);

      expect(result.script).toStrictEqual([["focus_by_opid", "password-field"]]);
    });

    it("returns a fill script with the username field if a password field is not present when adding a `focus_by_opid` action", () => {
      delete filledFields["password-field"];

      const result = AutofillService.setFillScriptForFocus(filledFields, fillScript);

      expect(result.script).toStrictEqual([["focus_by_opid", "username-field"]]);
    });
  });

  describe("fillByOpid", () => {
    let usernameField: AutofillField;
    let fillScript: AutofillScript;

    beforeEach(() => {
      usernameField = createAutofillFieldMock({
        opid: "username-field",
        type: "text",
        form: "validFormId",
        elementNumber: 0,
      });
      fillScript = createAutofillScriptMock({ script: [] });
    });

    it("returns a list of fill script actions for the passed field", () => {
      usernameField.maxLength = 5;
      AutofillService.fillByOpid(fillScript, usernameField, "some-long-value");

      expect(fillScript.script).toStrictEqual([
        ["click_on_opid", "username-field"],
        ["focus_by_opid", "username-field"],
        ["fill_by_opid", "username-field", "some-long-value"],
      ]);
    });

    it("returns only the `fill_by_opid` action if the passed field is a `span` element", () => {
      usernameField.tagName = "span";
      AutofillService.fillByOpid(fillScript, usernameField, "some-long-value");

      expect(fillScript.script).toStrictEqual([
        ["fill_by_opid", "username-field", "some-long-value"],
      ]);
    });
  });

  describe("forCustomFieldsOnly", () => {
    it("returns a true value if the passed field has a tag name of `span`", () => {
      const field = createAutofillFieldMock({ tagName: "span" });

      const result = AutofillService.forCustomFieldsOnly(field);

      expect(result).toBe(true);
    });

    it("returns a false value if the passed field does not have a tag name of `span`", () => {
      const field = createAutofillFieldMock({ tagName: "input" });

      const result = AutofillService.forCustomFieldsOnly(field);

      expect(result).toBe(false);
    });
  });
});
