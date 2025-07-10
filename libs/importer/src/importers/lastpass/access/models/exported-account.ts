// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Account } from "./account";

export class ExportedAccount {
  url: string;
  username: string;
  password: string;
  totp: string;
  extra: string;
  name: string;
  grouping: string;
  fav: number;

  constructor(account: Account) {
    this.url = account.url;
    this.username = account.username;
    this.password = account.password;
    this.totp = account.totp;
    this.extra = account.notes;
    this.name = account.name;
    this.grouping = account.path === "(none)" ? null : account.path;
    this.fav = account.isFavorite ? 1 : 0;
  }
}
