import { Utils } from "../../../platform/misc/utils";

// TODO: Tech Debt: potentially create a type Storage shape vs using a class here in the future
// type StorageShape {
//   id: string;
//   privateKey: string;
// }
// so we can get rid of the any type passed into fromJSON and coming out of ToJSON
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

  static fromJSON(obj: any): AdminAuthRequestStorable {
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
