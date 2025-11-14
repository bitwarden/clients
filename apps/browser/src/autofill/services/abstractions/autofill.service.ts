import { Observable } from "rxjs";

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
  focusedFieldOpid?: string;
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
  focusedFieldOpid?: string;
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
  /** Non-null asserted. */
  collectPageDetailsFromTab$!: (tab: chrome.tabs.Tab) => Observable<PageDetail[]>;
  /** Non-null asserted. */
  loadAutofillScriptsOnInstall!: () => Promise<void>;
  /** Non-null asserted. */
  reloadAutofillScripts!: () => Promise<void>;
  /** Non-null asserted. */
  injectAutofillScripts!: (
    tab: chrome.tabs.Tab,
    frameId?: number,
    triggeringOnPageLoad?: boolean,
  ) => Promise<void>;
  /** Non-null asserted. */
  getFormsWithPasswordFields!: (pageDetails: AutofillPageDetails) => FormData[];
  /** Non-null asserted. */
  doAutoFill!: (options: AutoFillOptions) => Promise<string | null>;
  /** Non-null asserted. */
  doAutoFillOnTab!: (
    pageDetails: PageDetail[],
    tab: chrome.tabs.Tab,
    fromCommand: boolean,
    autoSubmitLogin?: boolean,
  ) => Promise<string | null>;
  /** Non-null asserted. */
  doAutoFillActiveTab!: (
    pageDetails: PageDetail[],
    fromCommand: boolean,
    cipherType?: CipherType,
  ) => Promise<string | null>;
  /** Non-null asserted. */
  setAutoFillOnPageLoadOrgPolicy!: () => Promise<void>;
  /** Non-null asserted. */
  isPasswordRepromptRequired!: (
    cipher: CipherView,
    tab: chrome.tabs.Tab,
    action?: string,
  ) => Promise<boolean>;
}
