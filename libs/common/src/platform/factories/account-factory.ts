import { Account } from "../models/domain/account";

export class AccountFactory<T extends Account = Account> {
  private accountConstructor: new (init: Partial<T>) => T;

  constructor(accountConstructor: new (init: Partial<T>) => T) {
    this.accountConstructor = accountConstructor;
  }

  create(args: Partial<T>) {
    return new this.accountConstructor(args);
  }
}
