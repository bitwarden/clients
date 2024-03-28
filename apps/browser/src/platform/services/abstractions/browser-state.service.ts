import { StateService as BaseStateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";

import { Account } from "../../../models/account";
import { BrowserComponentState } from "../../../models/browserComponentState";
import { BrowserSendComponentState } from "../../../models/browserSendComponentState";

export abstract class BrowserStateService extends BaseStateServiceAbstraction<Account> {
  getBrowserSendComponentState: (options?: StorageOptions) => Promise<BrowserSendComponentState>;
  setBrowserSendComponentState: (
    value: BrowserSendComponentState,
    options?: StorageOptions,
  ) => Promise<void>;
  getBrowserSendTypeComponentState: (options?: StorageOptions) => Promise<BrowserComponentState>;
  setBrowserSendTypeComponentState: (
    value: BrowserComponentState,
    options?: StorageOptions,
  ) => Promise<void>;
}
