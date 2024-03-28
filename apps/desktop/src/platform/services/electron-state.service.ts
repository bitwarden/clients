import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { StateService as BaseStateService } from "@bitwarden/common/platform/services/state.service";

import { Account } from "../../models/account";

export class ElectronStateService extends BaseStateService<GlobalState, Account> {
  async addAccount(account: Account) {
    // Apply desktop overides to default account values
    account = new Account(account);
    await super.addAccount(account);
  }
}
