import { Guid } from "../../types/guid";
import { View } from "../view/view";

import { EncString } from "./enc-string";
import { SymmetricCryptoKey } from "./symmetric-crypto-key";

// https://contributing.bitwarden.com/architecture/clients/data-model#domain
export default class Domain {
  protected buildDomainModel<D extends Domain>(
    domain: D,
    dataObj: any,
    map: any,
    notEncList: any[] = []
  ) {
    for (const prop in map) {
      // eslint-disable-next-line
      if (!map.hasOwnProperty(prop)) {
        continue;
      }

      const objProp = dataObj[map[prop] || prop];
      if (notEncList.indexOf(prop) > -1) {
        (domain as any)[prop] = objProp ? objProp : null;
      } else {
        (domain as any)[prop] = objProp ? new EncString(objProp) : null;
      }
    }
  }
  protected buildDataModel<D extends Domain>(
    domain: D,
    dataObj: any,
    map: any,
    notEncStringList: any[] = []
  ) {
    for (const prop in map) {
      // eslint-disable-next-line
      if (!map.hasOwnProperty(prop)) {
        continue;
      }

      const objProp = (domain as any)[map[prop] || prop];
      if (notEncStringList.indexOf(prop) > -1) {
        (dataObj as any)[prop] = objProp != null ? objProp : null;
      } else {
        (dataObj as any)[prop] = objProp != null ? (objProp as EncString).encryptedString : null;
      }
    }
  }

  protected async decryptObj<T extends View>(
    viewModel: T,
    map: any,
    orgId: Guid,
    key: SymmetricCryptoKey = null
  ): Promise<T> {
    const promises = [];
    const self: any = this;

    for (const prop in map) {
      // eslint-disable-next-line
      if (!map.hasOwnProperty(prop)) {
        continue;
      }

      (function (theProp) {
        const p = Promise.resolve()
          .then(() => {
            const mapProp = map[theProp] || theProp;
            if (self[mapProp]) {
              return self[mapProp].decrypt(orgId, key);
            }
            return null;
          })
          .then((val: any) => {
            (viewModel as any)[theProp] = val;
          });
        promises.push(p);
      })(prop);
    }

    await Promise.all(promises);
    return viewModel;
  }
}
