// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { Utils } from "../../../platform/misc/utils";

export class AdminAuthRequestStorable {
  id: string;
  privateKey: Uint8Array;

  constructor(init?: Partial<AdminAuthRequestStorable>) {
    if (init) {
      Object.assign(this, init);
    }
  }

  toJSON() {
    return {
      id: this.id,
      privateKey: Utils.fromBufferToByteString(this.privateKey),
    };
  }

  static fromJSON(obj: Jsonify<AdminAuthRequestStorable>): AdminAuthRequestStorable {
    if (obj == null) {
      return null;
    }

    let privateKeyBuffer = null;
    if (obj.privateKey) {
      privateKeyBuffer = Utils.fromByteStringToArray(obj.privateKey);
    }

    return new AdminAuthRequestStorable({
      id: obj.id,
      privateKey: privateKeyBuffer,
    });
  }
}
