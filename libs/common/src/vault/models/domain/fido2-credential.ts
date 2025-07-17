// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { Fido2Credential as SdkFido2Credential } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import Domain from "../../../platform/models/domain/domain-base";
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
    const view = await this.decryptObj<Fido2Credential, Fido2CredentialView>(
      this,
      new Fido2CredentialView(),
      [
        "credentialId",
        "keyType",
        "keyAlgorithm",
        "keyCurve",
        "keyValue",
        "rpId",
        "userHandle",
        "userName",
        "rpName",
        "userDisplayName",
      ],
      orgId,
      encKey,
    );

    const { counter } = await this.decryptObj<
      Fido2Credential,
      {
        counter: string;
      }
    >(this, { counter: "" }, ["counter"], orgId, encKey);
    // Counter will end up as NaN if this fails
    view.counter = parseInt(counter);

    const { discoverable } = await this.decryptObj<Fido2Credential, { discoverable: string }>(
      this,
      { discoverable: "" },
      ["discoverable"],
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

  /**
   *  Maps Fido2Credential to SDK format.
   *
   * @returns {SdkFido2Credential} The SDK Fido2Credential object.
   */
  toSdkFido2Credential(): SdkFido2Credential {
    return {
      credentialId: this.credentialId?.toJSON(),
      keyType: this.keyType.toJSON(),
      keyAlgorithm: this.keyAlgorithm.toJSON(),
      keyCurve: this.keyCurve.toJSON(),
      keyValue: this.keyValue.toJSON(),
      rpId: this.rpId.toJSON(),
      userHandle: this.userHandle?.toJSON(),
      userName: this.userName?.toJSON(),
      counter: this.counter.toJSON(),
      rpName: this.rpName?.toJSON(),
      userDisplayName: this.userDisplayName?.toJSON(),
      discoverable: this.discoverable?.toJSON(),
      creationDate: this.creationDate.toISOString(),
    };
  }

  /**
   * Maps an SDK Fido2Credential object to a Fido2Credential
   * @param obj - The SDK Fido2Credential object
   */
  static fromSdkFido2Credential(obj: SdkFido2Credential): Fido2Credential | undefined {
    if (!obj) {
      return undefined;
    }

    const credential = new Fido2Credential();

    credential.credentialId = EncString.fromJSON(obj.credentialId);
    credential.keyType = EncString.fromJSON(obj.keyType);
    credential.keyAlgorithm = EncString.fromJSON(obj.keyAlgorithm);
    credential.keyCurve = EncString.fromJSON(obj.keyCurve);
    credential.keyValue = EncString.fromJSON(obj.keyValue);
    credential.rpId = EncString.fromJSON(obj.rpId);
    credential.userHandle = EncString.fromJSON(obj.userHandle);
    credential.userName = EncString.fromJSON(obj.userName);
    credential.counter = EncString.fromJSON(obj.counter);
    credential.rpName = EncString.fromJSON(obj.rpName);
    credential.userDisplayName = EncString.fromJSON(obj.userDisplayName);
    credential.discoverable = EncString.fromJSON(obj.discoverable);
    credential.creationDate = new Date(obj.creationDate);

    return credential;
  }
}
