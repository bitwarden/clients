import { mock } from "jest-mock-extended";

import { UriMatchType } from "@bitwarden/common/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import AutofillField from "../models/autofill-field";
import AutofillPageDetails from "../models/autofill-page-details";
import AutofillScript, { FillScript } from "../models/autofill-script";
import { GenerateFillScriptOptions } from "../services/abstractions/autofill.service";

function createAutofillFieldMock(customFields = {}): AutofillField {
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

function createAutofillPageDetailsMock(customFields = {}): AutofillPageDetails {
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

function createChromeTabMock(customFields = {}): chrome.tabs.Tab {
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
    groupId: 2,
    url: "https://tacos.com",
    ...customFields,
  };
}

function createGenerateFillScriptOptionsMock(customFields = {}): GenerateFillScriptOptions {
  return {
    skipUsernameOnlyFill: false,
    onlyEmptyFields: false,
    onlyVisibleFields: false,
    fillNewPassword: false,
    allowTotpAutofill: false,
    cipher: mock<CipherView>(),
    tabUrl: "https://tacos.com",
    defaultUriMatch: UriMatchType.Domain,
    ...customFields,
  };
}

function createAutofillScriptMock(
  customFields = {},
  scriptTypes?: Record<string, string>
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

export {
  createAutofillFieldMock,
  createAutofillPageDetailsMock,
  createChromeTabMock,
  createGenerateFillScriptOptionsMock,
  createAutofillScriptMock,
};
