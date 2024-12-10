// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import Domain from "../../../platform/models/domain/domain-base";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { Fido2CredentialData } from "../data/fido2-credential.data";
import { Fido2CredentialView } from "../view/fido2-credential.view";

export class Fido2Credential extends Domain {
  credentialId: EncString | null = null;
  keyType: EncString;
  keyAlgorithm: EncString;
  keyCurve: EncString;
  keyValue: EncString;
  rpId: EncString;
  userHandle: EncString;
  userName: EncString;
  counter: EncString;
  rpName: EncString;
  userDisplayName: EncString;
  discoverable: EncString;
  creationDate: Date;

  constructor(obj?: Fido2CredentialData) {
    super();
    if (obj == null) {
      return;
    }

    this.buildDomainModel(
      this,
      obj,
      {
        credentialId: null,
        keyType: null,
        keyAlgorithm: null,
        keyCurve: null,
        keyValue: null,
        rpId: null,
        userHandle: null,
        userName: null,
        counter: null,
        rpName: null,
        userDisplayName: null,
        discoverable: null,
      },
      [],
    );
    this.creationDate = obj.creationDate != null ? new Date(obj.creationDate) : null;
  }

  async decrypt(orgId: string, encKey?: SymmetricCryptoKey): Promise<Fido2CredentialView> {
    const view = await this.decryptObj(
      new Fido2CredentialView(),
      {
        credentialId: null,
        keyType: null,
        keyAlgorithm: null,
        keyCurve: null,
        keyValue: null,
        rpId: null,
        userHandle: null,
        userName: null,
        rpName: null,
        userDisplayName: null,
        discoverable: null,
      },
      orgId,
      encKey,
    );

    const { counter } = await this.decryptObj(
      { counter: "" },
      {
        counter: null,
      },
      orgId,
      encKey,
    );
    // Counter will end up as NaN if this fails
    view.counter = parseInt(counter);

    const { discoverable } = await this.decryptObj(
      { discoverable: "" },
      {
        discoverable: null,
      },
      orgId,
      encKey,
    );
    view.discoverable = discoverable === "true";
    view.creationDate = this.creationDate;

    return view;
  }

  toFido2CredentialData(): Fido2CredentialData {
    const i = new Fido2CredentialData();
    i.creationDate = this.creationDate.toISOString();
    this.buildDataModel(this, i, {
      credentialId: null,
      keyType: null,
      keyAlgorithm: null,
      keyCurve: null,
      keyValue: null,
      rpId: null,
      userHandle: null,
      userName: null,
      counter: null,
      rpName: null,
      userDisplayName: null,
      discoverable: null,
    });
    return i;
  }

  static fromJSON(obj: Jsonify<Fido2Credential>): Fido2Credential {
    if (obj == null) {
      return null;
    }

    const credentialId = EncString.fromJSON(obj.credentialId);
    const keyType = EncString.fromJSON(obj.keyType);
    const keyAlgorithm = EncString.fromJSON(obj.keyAlgorithm);
    const keyCurve = EncString.fromJSON(obj.keyCurve);
    const keyValue = EncString.fromJSON(obj.keyValue);
    const rpId = EncString.fromJSON(obj.rpId);
    const userHandle = EncString.fromJSON(obj.userHandle);
    const userName = EncString.fromJSON(obj.userName);
    const counter = EncString.fromJSON(obj.counter);
    const rpName = EncString.fromJSON(obj.rpName);
    const userDisplayName = EncString.fromJSON(obj.userDisplayName);
    const discoverable = EncString.fromJSON(obj.discoverable);
    const creationDate = obj.creationDate != null ? new Date(obj.creationDate) : null;

    return Object.assign(new Fido2Credential(), obj, {
      credentialId,
      keyType,
      keyAlgorithm,
      keyCurve,
      keyValue,
      rpId,
      userHandle,
      userName,
      counter,
      rpName,
      userDisplayName,
      discoverable,
      creationDate,
    });
  }
}
