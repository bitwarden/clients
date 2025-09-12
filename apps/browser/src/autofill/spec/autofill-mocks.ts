// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock } from "jest-mock-extended";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  FocusedFieldData,
  InlineMenuCipherData,
} from "../background/abstractions/overlay.background";
import AutofillField from "../models/autofill-field";
import AutofillForm from "../models/autofill-form";
import AutofillPageDetails from "../models/autofill-page-details";
import AutofillScript, { FillScript } from "../models/autofill-script";
import { InitAutofillInlineMenuButtonMessage } from "../overlay/inline-menu/abstractions/autofill-inline-menu-button";
import { InitAutofillInlineMenuListMessage } from "../overlay/inline-menu/abstractions/autofill-inline-menu-list";
import { GenerateFillScriptOptions, PageDetail } from "../services/abstractions/autofill.service";

export function createAutofillFormMock(customFields = {}): AutofillForm {
  return {
    opid: "default-form-opid",
    htmlID: "default-htmlID",
    htmlAction: "default-htmlAction",
    htmlMethod: "default-htmlMethod",
    htmlName: "default-htmlName",
    ...customFields,
  };
}

export function createAutofillFieldMock(customFields = {}): AutofillField {
  return {
    opid: "default-input-field-opid",
    elementNumber: 0,
    viewable: true,
    htmlID: "default-htmlID",
    htmlName: "default-htmlName",
    htmlClass: "default-htmlClass",
    tabindex: "0",
    title: "default-title",
    "label-left": "default-label-left",
    "label-right": "default-label-right",
    "label-top": "default-label-top",
    "label-tag": "default-label-tag",
    "label-aria": "default-label-aria",
    placeholder: "default-placeholder",
    type: "text",
    value: "default-value",
    disabled: false,
    readonly: false,
    onePasswordFieldType: "",
    form: "invalidFormId",
    autoCompleteType: "off",
    selectInfo: "",
    maxLength: 0,
    tagName: "input",
    ...customFields,
  };
}

export function createPageDetailMock(customFields = {}): PageDetail {
  return {
    frameId: 0,
    tab: createChromeTabMock(),
    details: createAutofillPageDetailsMock(),
    ...customFields,
  };
}

export function createAutofillPageDetailsMock(customFields = {}): AutofillPageDetails {
  return {
    title: "title",
    url: "url",
    documentUrl: "documentUrl",
    forms: {
      validFormId: {
        opid: "opid",
        htmlName: "htmlName",
        htmlID: "htmlID",
        htmlAction: "htmlAction",
        htmlMethod: "htmlMethod",
      },
    },
    fields: [createAutofillFieldMock({ opid: "non-password-field" })],
    collectedTimestamp: 0,
    ...customFields,
  };
}

export function createChromeTabMock(customFields = {}): chrome.tabs.Tab {
  return {
    id: 1,
    index: 1,
    pinned: false,
    highlighted: false,
    windowId: 2,
    active: true,
    incognito: false,
    selected: true,
    discarded: false,
    autoDiscardable: false,
    frozen: false,
    groupId: 2,
    url: "https://jest-testing-website.com",
    ...customFields,
  };
}

export function createGenerateFillScriptOptionsMock(customFields = {}): GenerateFillScriptOptions {
  return {
    skipUsernameOnlyFill: false,
    onlyEmptyFields: false,
    fillNewPassword: false,
    allowTotpAutofill: false,
    autoSubmitLogin: false,
    cipher: mock<CipherView>(),
    tabUrl: "https://jest-testing-website.com",
    defaultUriMatch: UriMatchStrategy.Domain,
    ...customFields,
  };
}

export function createAutofillScriptMock(
  customFields = {},
  scriptTypes?: Record<string, string>,
): AutofillScript {
  let script: FillScript[] = [
    ["click_on_opid", "default-field"],
    ["focus_by_opid", "default-field"],
    ["fill_by_opid", "default-field", "default"],
  ];
  if (scriptTypes) {
    script = [];
    for (const scriptType in scriptTypes) {
      script.push(["click_on_opid", scriptType]);
      script.push(["focus_by_opid", scriptType]);
      script.push(["fill_by_opid", scriptType, scriptTypes[scriptType]]);
    }
  }

  return {
    autosubmit: null,
    metadata: {},
    properties: {
      delay_between_operations: 20,
    },
    savedUrls: [],
    script,
    itemType: "",
    untrustedIframe: false,
    ...customFields,
  };
}

const overlayPagesTranslations = {
  locale: "en",
  opensInANewWindow: "opensInANewWindow",
  toggleBitwardenVaultOverlay: "toggleBitwardenVaultOverlay",
  unlockYourAccountToViewAutofillSuggestions: "unlockYourAccountToViewAutofillSuggestions",
  unlockAccount: "unlockAccount",
  fillCredentialsFor: "fillCredentialsFor",
  username: "username",
  view: "view",
  noItemsToShow: "noItemsToShow",
  newItem: "newItem",
  addNewVaultItem: "addNewVaultItem",
};
export function createInitAutofillInlineMenuButtonMessageMock(
  customFields = {},
): InitAutofillInlineMenuButtonMessage {
  return {
    command: "initAutofillInlineMenuButton",
    translations: overlayPagesTranslations,
    styleSheetUrl: "https://jest-testing-website.com",
    authStatus: AuthenticationStatus.Unlocked,
    portKey: "portKey",
    ...customFields,
  };
}
export function createAutofillOverlayCipherDataMock(
  index: number,
  customFields = {},
): InlineMenuCipherData {
  return {
    id: String(index),
    name: `website login ${index}`,
    login: {
      username: `username${index}`,
      passkey: null,
    },
    type: CipherType.Login,
    reprompt: CipherRepromptType.None,
    favorite: false,
    icon: {
      imageEnabled: true,
      image: "https://jest-testing-website.com/image.png",
      fallbackImage: "https://jest-testing-website.com/fallback.png",
      icon: "bw-icon",
    },
    ...customFields,
  };
}

export function createInitAutofillInlineMenuListMessageMock(
  customFields = {},
): InitAutofillInlineMenuListMessage {
  return {
    command: "initAutofillInlineMenuList",
    translations: overlayPagesTranslations,
    styleSheetUrl: "https://jest-testing-website.com",
    theme: ThemeTypes.Light,
    authStatus: AuthenticationStatus.Unlocked,
    portKey: "portKey",
    inlineMenuFillType: CipherType.Login,
    ciphers: [
      createAutofillOverlayCipherDataMock(1, {
        icon: {
          imageEnabled: true,
          image: "https://jest-testing-website.com/image.png",
          fallbackImage: "",
          icon: "bw-icon",
        },
      }),
      createAutofillOverlayCipherDataMock(2, {
        icon: {
          imageEnabled: true,
          image: "",
          fallbackImage: "https://jest-testing-website.com/fallback.png",
          icon: "bw-icon",
        },
      }),
      createAutofillOverlayCipherDataMock(3, {
        name: "",
        login: { username: "" },
        icon: { imageEnabled: true, image: "", fallbackImage: "", icon: "bw-icon" },
      }),
      createAutofillOverlayCipherDataMock(4, {
        icon: { imageEnabled: false, image: "", fallbackImage: "", icon: "" },
      }),
      createAutofillOverlayCipherDataMock(5),
      createAutofillOverlayCipherDataMock(6),
      createAutofillOverlayCipherDataMock(7),
      createAutofillOverlayCipherDataMock(8),
    ],
    ...customFields,
  };
}

export function createFocusedFieldDataMock(
  customFields: Partial<FocusedFieldData> = {},
): FocusedFieldData {
  return {
    focusedFieldRects: {
      top: 1,
      left: 2,
      height: 3,
      width: 4,
    },
    focusedFieldStyles: {
      paddingRight: "6px",
      paddingLeft: "6px",
    },
    inlineMenuFillType: CipherType.Login,
    tabId: 1,
    frameId: 2,
    ...customFields,
  };
}

export function createPortSpyMock(name: string) {
  return mock<chrome.runtime.Port>({
    name,
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onDisconnect: {
      addListener: jest.fn(),
    },
    postMessage: jest.fn(),
    disconnect: jest.fn(),
    sender: {
      tab: createChromeTabMock(),
      url: "https://jest-testing-website.com",
    },
  });
}

export function createMutationRecordMock(customFields = {}): MutationRecord {
  return {
    addedNodes: mock<NodeList>(),
    attributeName: "default-attributeName",
    attributeNamespace: "default-attributeNamespace",
    nextSibling: null,
    oldValue: "default-oldValue",
    previousSibling: null,
    removedNodes: mock<NodeList>(),
    target: null,
    type: "attributes",
    ...customFields,
  };
}
