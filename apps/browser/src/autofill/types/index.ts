import { VaultTimeout, VaultTimeoutAction } from "@bitwarden/common/key-management/vault-timeout";
import { Region } from "@bitwarden/common/platform/abstractions/environment.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import type { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import type { InlineMenuFillType } from "../enums/autofill-overlay.enum";
import type AutofillPageDetails from "../models/autofill-page-details";

/** The details a frame of a tab answered a collect with. */
export interface PageDetail {
  frameId: number;
  tab: chrome.tabs.Tab;
  details: AutofillPageDetails;
}

/** A tab the browser has given an id. */
export type IdentifiedTab = chrome.tabs.Tab & { id: number };

/**
 * Everything the autofill service needs to fill a cipher into a page: the cipher, the page's
 * details, the tab, and the flags that shape the fill.
 */
export interface AutoFillOptions {
  cipher: CipherView;
  pageDetails: PageDetail[];
  doc?: typeof self.document;
  tab: chrome.tabs.Tab;
  skipUsernameOnlyFill?: boolean;
  onlyEmptyFields?: boolean;
  fillNewPassword?: boolean;
  skipLastUsed?: boolean;
  /**
   * Whether a frame whose URL is not the tab's, and matches none of the cipher's URIs, may be
   * filled. Absent allows it.
   */
  allowUntrustedIframe?: boolean;
  allowTotpAutofill?: boolean;
  autoSubmitLogin?: boolean;
  focusedFieldForm?: string;
  focusedFieldOpid?: string;
  inlineMenuFillType?: InlineMenuFillType;
}

export type UserSettings = {
  avatarColor: string | null;
  environmentUrls: {
    api: string | null;
    base: string | null;
    events: string | null;
    icons: string | null;
    identity: string | null;
    keyConnector: string | null;
    notifications: string | null;
    webVault: string | null;
  };
  pinProtected: { [key: string]: any };
  region: Region;
  serverConfig: {
    environment: {
      api: string | null;
      cloudRegion: string | null;
      identity: string | null;
      notifications: string | null;
      sso: string | null;
      vault: string | null;
    };
    featureStates: { [key: string]: any };
    gitHash: string;
    server: { [key: string]: any };
    utcDate: string;
    version: string;
  };
  vaultTimeout: VaultTimeout;
  vaultTimeoutAction: VaultTimeoutAction;
};

/**
 * A HTMLElement (usually a form element) with additional custom properties added by this script
 */
export type ElementWithOpId<T> = T & {
  opid: string;
};

/**
 * A Form Element that we can set a value on (fill)
 */
export type FillableFormFieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * The autofill script's definition of a Form Element (only a subset of HTML form elements)
 */
export type FormFieldElement = FillableFormFieldElement | HTMLSpanElement;

export type FormElementWithAttribute = FormFieldElement & Record<string, string | null | undefined>;

export type AutofillCipherTypeId =
  | typeof CipherType.Login
  | typeof CipherType.Card
  | typeof CipherType.Identity
  | typeof CipherType.SshKey;
