import { StateService as BaseStateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";

import { Account } from "../../../models/account";
import { BrowserComponentState } from "../../../models/browserComponentState";
import { BrowserGroupingsComponentState } from "../../../models/browserGroupingsComponentState";

export abstract class BrowserStateService extends BaseStateServiceAbstraction<Account> {
  getBrowserGroupingComponentState: (
    options?: StorageOptions,
  ) => Promise<BrowserGroupingsComponentState>;
  setBrowserGroupingComponentState: (
    value: BrowserGroupingsComponentState,
    options?: StorageOptions,
  ) => Promise<void>;
  getBrowserVaultItemsComponentState: (options?: StorageOptions) => Promise<BrowserComponentState>;
  setBrowserVaultItemsComponentState: (
    value: BrowserComponentState,
    options?: StorageOptions,
  ) => Promise<void>;
}
