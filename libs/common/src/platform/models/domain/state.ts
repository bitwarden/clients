// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { Account } from "./account";
import { GlobalState } from "./global-state";

export class State<
  TGlobalState extends GlobalState = GlobalState,
  TAccount extends Account = Account,
> {
  accounts: { [userId: string]: TAccount } = {};
  globals: TGlobalState;

  constructor(globals: TGlobalState) {
    this.globals = globals;
  }

  // TODO, make Jsonify<State,TGlobalState,TAccount> work. It currently doesn't because Globals doesn't implement Jsonify.
  static fromJSON<TGlobalState extends GlobalState, TAccount extends Account>(
    obj: any,
    accountDeserializer: (json: Jsonify<TAccount>) => TAccount,
  ): State<TGlobalState, TAccount> {
    if (obj == null) {
      return null;
    }

    return Object.assign(new State(null), obj, {
      accounts: State.buildAccountMapFromJSON(obj?.accounts, accountDeserializer),
    });
  }

  private static buildAccountMapFromJSON<TAccount extends Account>(
    jsonAccounts: { [userId: string]: Jsonify<TAccount> },
    accountDeserializer: (json: Jsonify<TAccount>) => TAccount,
  ) {
    if (!jsonAccounts) {
      return {};
    }
    const accounts: { [userId: string]: TAccount } = {};
    for (const userId in jsonAccounts) {
      accounts[userId] = accountDeserializer(jsonAccounts[userId]);
    }
    return accounts;
  }
}
