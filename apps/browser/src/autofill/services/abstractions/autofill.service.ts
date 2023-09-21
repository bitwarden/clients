import { UriMatchType } from "@bitwarden/common/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

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
  doc?: typeof window.document;
  tab: chrome.tabs.Tab;
  skipUsernameOnlyFill?: boolean;
  onlyEmptyFields?: boolean;
  onlyVisibleFields?: boolean;
  fillNewPassword?: boolean;
  skipLastUsed?: boolean;
  allowUntrustedIframe?: boolean;
  allowTotpAutofill?: boolean;
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
  onlyVisibleFields: boolean;
  fillNewPassword: boolean;
  allowTotpAutofill: boolean;
  cipher: CipherView;
  tabUrl: string;
  defaultUriMatch: UriMatchType;
}

export abstract class AutofillService {
  injectAutofillScripts: (
    sender: chrome.runtime.MessageSender,
    autofillV2?: boolean
  ) => Promise<void>;
  getFormsWithPasswordFields: (pageDetails: AutofillPageDetails) => FormData[];
  doAutoFill: (options: AutoFillOptions) => Promise<string | null>;
  doAutoFillOnTab: (
    pageDetails: PageDetail[],
    tab: chrome.tabs.Tab,
    fromCommand: boolean
  ) => Promise<string | null>;
  doAutoFillActiveTab: (pageDetails: PageDetail[], fromCommand: boolean) => Promise<string | null>;
}
