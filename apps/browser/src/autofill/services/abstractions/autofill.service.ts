import { Observable } from "rxjs";

import { UriMatchStrategySetting } from "@bitwarden/common/models/domain/domain-service";
import { CommandDefinition } from "@bitwarden/common/platform/messaging";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillMessageCommand } from "../../enums/autofill-message.enums";
import { InlineMenuFillType } from "../../enums/autofill-overlay.enum";
import AutofillField from "../../models/autofill-field";
import AutofillForm from "../../models/autofill-form";
import AutofillPageDetails from "../../models/autofill-page-details";

export interface PageDetail {
  frameId: number;
  tab: chrome.tabs.Tab;
  details: AutofillPageDetails;
}

/**
 * The outcome of an autofill attempt.
 *
 * @example
 * const result = await autofillService.doAutoFill(options);
 * if (result.didAutofill && result.totp != null) {
 *   copyToClipboard(result.totp);
 * }
 */
export type AutoFillResult =
  | {
      /** Whether a fill script was dispatched to at least one frame. */
      didAutofill: false;
    }
  | {
      /** Whether a fill script was dispatched to at least one frame. */
      didAutofill: true;
      /** The TOTP code to copy after a successful login fill; absent when the fill produced no TOTP. */
      totp?: string;
    };

/** The shared "no fill happened" outcome. Frozen so every no-fill path returns one instance. */
export const DID_NOT_AUTOFILL: AutoFillResult = Object.freeze({ didAutofill: false });

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
  inlineMenuFillType?: InlineMenuFillType;
}

interface FormDataBase {
  form: AutofillForm;
  password: AutofillField;
  passwords: AutofillField[];
}

export interface FormDataWithUsername extends FormDataBase {
  username: AutofillField;
}

export interface FormDataPasswordOnly extends FormDataBase {
  username: null;
}

export type FormData = FormDataWithUsername | FormDataPasswordOnly;

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
  inlineMenuFillType?: InlineMenuFillType;
}

export type CollectPageDetailsResponseMessage = {
  tab: chrome.tabs.Tab;
  details: AutofillPageDetails;
  sender?: string;
};

export const COLLECT_PAGE_DETAILS_RESPONSE_COMMAND =
  new CommandDefinition<CollectPageDetailsResponseMessage>(
    AutofillMessageCommand.collectPageDetailsResponse,
  );

export abstract class AutofillService {
  enableInlineMenuAnimation$!: Observable<boolean>;
  enableNotificationAnimation$!: Observable<boolean>;
  /** Non-null asserted. */
  collectPageDetailsFromTab$!: (tab: chrome.tabs.Tab, frameId?: number) => Observable<PageDetail[]>;
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
  /**
   * Fills a concrete cipher into the instructed tab/frame(s) and reports the
   * outcome. Cipher selection and active-tab verification are the caller's concern.
   *
   * If you're calling this method, you're probably doing it wrong. Use the
   * {@link AutofillOrchestrator} to request an autofill!
   */
  doAutoFill!: (options: AutoFillOptions) => Promise<AutoFillResult>;
  /** Non-null asserted. */
  setAutoFillOnPageLoadOrgPolicy!: () => Promise<void>;
  /** Non-null asserted. */
  isPasswordRepromptRequired!: (
    cipher: CipherView,
    tab: chrome.tabs.Tab,
    action?: string,
  ) => Promise<boolean>;
}
