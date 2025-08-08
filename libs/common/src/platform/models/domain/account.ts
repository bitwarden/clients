// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

export class AccountProfile {
  name?: string;
  email?: string;
  emailVerified?: boolean;
  userId?: string;

  static fromJSON(obj: Jsonify<AccountProfile>): AccountProfile {
    if (obj == null) {
      return null;
    }

    return Object.assign(new AccountProfile(), obj);
  }
}

export class Account {
  profile?: AccountProfile = new AccountProfile();

  constructor(init: Partial<Account>) {
    Object.assign(this, {
      profile: {
        ...new AccountProfile(),
        ...init?.profile,
      },
    });
  }

  static fromJSON(json: Jsonify<Account>): Account {
    if (json == null) {
      return null;
    }

    return Object.assign(new Account({}), json, {
      profile: AccountProfile.fromJSON(json?.profile),
    });
  }
}
