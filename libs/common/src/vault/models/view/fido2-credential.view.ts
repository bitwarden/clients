// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { ItemView } from "./item.view";

export class Fido2CredentialView extends ItemView {
  credentialId: string;
  keyType: "public-key";
  keyAlgorithm: "ECDSA";
  keyCurve: "P-256";
  keyValue: string;
  rpId: string;
  userHandle: string;
  userName: string;
  counter: number;
  rpName: string;
  userDisplayName: string;
  discoverable: boolean;
  creationDate: Date = null;

  get subTitle(): string {
    return this.userDisplayName;
  }

  static fromJSON(obj: Partial<Jsonify<Fido2CredentialView>>): Fido2CredentialView {
    const creationDate = obj.creationDate != null ? new Date(obj.creationDate) : null;
    return Object.assign(new Fido2CredentialView(), obj, {
      creationDate,
    });
  }
}
