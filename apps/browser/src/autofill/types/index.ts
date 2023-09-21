import { Region } from "@bitwarden/common/platform/abstractions/environment.service";
import { VaultTimeoutAction } from "@bitwarden/common/src/enums/vault-timeout-action.enum";

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
  settings: {
    equivalentDomains: string[][];
  };
  neverDomains?: { [key: string]: any };
  disableAddLoginNotification?: boolean;
  disableChangedPasswordNotification?: boolean;
  vaultTimeout: number;
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
