import { Jsonify } from "type-fest";

import { Guid } from "../../types/guid";

import { Account } from "./account";
import { GlobalState } from "./global-state";

export class State<
  TGlobalState extends GlobalState = GlobalState,
  TAccount extends Account = Account
> {
  accounts: { [userId: Guid]: TAccount } = {};
  globals: TGlobalState;
  activeUserId: Guid;
  authenticatedAccounts: Guid[] = [];
  accountActivity: { [userId: Guid]: number } = {};

  constructor(globals: TGlobalState) {
    this.globals = globals;
  }

  // TODO, make Jsonify<State,TGlobalState,TAccount> work. It currently doesn't because Globals doesn't implement Jsonify.
  static fromJSON<TGlobalState extends GlobalState, TAccount extends Account>(
    obj: any,
    accountDeserializer: (json: Jsonify<TAccount>) => TAccount
  ): State<TGlobalState, TAccount> {
    if (obj == null) {
      return null;
    }

    return Object.assign(new State(null), obj, {
      accounts: State.buildAccountMapFromJSON(obj?.accounts, accountDeserializer),
    });
  }

  private static buildAccountMapFromJSON<TAccount extends Account>(
    jsonAccounts: Record<Guid, Jsonify<TAccount>>,
    accountDeserializer: (json: Jsonify<TAccount>) => TAccount
  ) {
    if (!jsonAccounts) {
      return {};
    }
    const accounts: Record<Guid, TAccount> = {};
    Object.entries(jsonAccounts).forEach(([userId, account]) => {
      accounts[userId as Guid] = accountDeserializer(account);
    });
    return accounts;
  }
}
