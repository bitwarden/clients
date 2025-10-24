// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { AutofillTargetingRules } from "@bitwarden/common/autofill/types";
import { UriMatchStrategySetting } from "@bitwarden/common/models/domain/domain-service";
import { CommandDefinition } from "@bitwarden/common/platform/messaging";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillMessageCommand } from "../../enums/autofill-message.enums";
import AutofillField from "../../models/autofill-field";
import AutofillForm from "../../models/autofill-form";
import AutofillPageDetails from "../../models/autofill-page-details";

export interface PageDetail {
  frameId: number;
  tab: chrome.tabs.Tab;
  details: AutofillPageDetails;
}

export interface AutoFillOptions {
  cipher: CipherView;
  pageDetails: PageDetail[];
  doc?: typeof self.document;
  tab: chrome.tabs.Tab;
  skipUsernameOnlyFill?: boolean;
  onlyEmptyFields?: boolean;
  fillNewPassword?: boolean;
  skipLastUsed?: boolean;
  allowUntrustedIframe?: boolean;
  allowTotpAutofill?: boolean;
  autoSubmitLogin?: boolean;
  focusedFieldForm?: string;
}

export interface FormData {
  form: AutofillForm;
  password: AutofillField;
  username: AutofillField;
  passwords: AutofillField[];
}

export interface GenerateFillScriptOptions {
  skipUsernameOnlyFill: boolean;
  onlyEmptyFields: boolean;
  fillNewPassword: boolean;
  allowTotpAutofill: boolean;
  autoSubmitLogin: boolean;
  cipher: CipherView;
  tabUrl: string;
  defaultUriMatch: UriMatchStrategySetting;
  pageTargetingRules?: AutofillTargetingRules;
}

export type CollectPageDetailsResponseMessage = {
  tab: chrome.tabs.Tab;
  details: AutofillPageDetails;
  sender?: string;
  webExtSender: chrome.runtime.MessageSender;
};

export const COLLECT_PAGE_DETAILS_RESPONSE_COMMAND =
  new CommandDefinition<CollectPageDetailsResponseMessage>(
    AutofillMessageCommand.collectPageDetailsResponse,
  );

export abstract class AutofillService {
  collectPageDetailsFromTab$: (tab: chrome.tabs.Tab) => Observable<PageDetail[]>;
  loadAutofillScriptsOnInstall: () => Promise<void>;
  reloadAutofillScripts: () => Promise<void>;
  injectAutofillScripts: (
    tab: chrome.tabs.Tab,
    frameId?: number,
    triggeringOnPageLoad?: boolean,
  ) => Promise<void>;
  getFormsWithPasswordFields: (pageDetails: AutofillPageDetails) => FormData[];
  getPageTagetingRules: (url: chrome.tabs.Tab["url"]) => Promise<AutofillTargetingRules>;
  doAutoFill: (options: AutoFillOptions) => Promise<string | null>;
  doAutoFillOnTab: (
    pageDetails: PageDetail[],
    tab: chrome.tabs.Tab,
    fromCommand: boolean,
    autoSubmitLogin?: boolean,
  ) => Promise<string | null>;
  doAutoFillActiveTab: (
    pageDetails: PageDetail[],
    fromCommand: boolean,
    cipherType?: CipherType,
  ) => Promise<string | null>;
  setAutoFillOnPageLoadOrgPolicy: () => Promise<void>;
  isPasswordRepromptRequired: (
    cipher: CipherView,
    tab: chrome.tabs.Tab,
    action?: string,
  ) => Promise<boolean>;
}
