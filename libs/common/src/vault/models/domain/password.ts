// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { PasswordHistory } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { PasswordHistoryData } from "../data/password-history.data";
import { PasswordHistoryView } from "../view/password-history.view";

export class Password extends Domain {
  password: EncString;
  lastUsedDate: Date;

  constructor(obj?: PasswordHistoryData) {
    super();
    if (obj == null) {
      return;
    }

    this.buildDomainModel(this, obj, {
      password: null,
    });
    this.lastUsedDate = new Date(obj.lastUsedDate);
  }

  decrypt(orgId: string, encKey?: SymmetricCryptoKey): Promise<PasswordHistoryView> {
    return this.decryptObj<Password, PasswordHistoryView>(
      this,
      new PasswordHistoryView(this),
      ["password"],
      orgId,
      encKey,
      "DomainType: PasswordHistory",
    );
  }

  toPasswordHistoryData(): PasswordHistoryData {
    const ph = new PasswordHistoryData();
    ph.lastUsedDate = this.lastUsedDate.toISOString();
    this.buildDataModel(this, ph, {
      password: null,
    });
    return ph;
  }

  static fromJSON(obj: Partial<Jsonify<Password>>): Password {
    if (obj == null) {
      return null;
    }

    const password = EncString.fromJSON(obj.password);
    const lastUsedDate = obj.lastUsedDate == null ? null : new Date(obj.lastUsedDate);

    return Object.assign(new Password(), obj, {
      password,
      lastUsedDate,
    });
  }

  /**
   * Maps Password to SDK format.
   *
   * @returns {PasswordHistory} The SDK password history object.
   */
  toSdkPasswordHistory(): PasswordHistory {
    return {
      password: this.password.toJSON(),
      lastUsedDate: this.lastUsedDate.toISOString(),
    };
  }

  /**
   * Maps an SDK PasswordHistory object to a Password
   * @param obj - The SDK PasswordHistory object
   */
  static fromSdkPasswordHistory(obj: PasswordHistory): Password | undefined {
    if (!obj) {
      return undefined;
    }

    const passwordHistory = new Password();
    passwordHistory.password = EncString.fromJSON(obj.password);
    passwordHistory.lastUsedDate = new Date(obj.lastUsedDate);

    return passwordHistory;
  }
}
