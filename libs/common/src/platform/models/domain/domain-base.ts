import { ConditionalExcept, ConditionalKeys } from "type-fest";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import { View } from "../../../models/view/view";

import { SymmetricCryptoKey } from "./symmetric-crypto-key";

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type EncStringKeys<T> = ConditionalKeys<ConditionalExcept<T, Function>, EncString>;
export type DecryptedObject<
  TEncryptedObject,
  TDecryptedKeys extends EncStringKeys<TEncryptedObject>,
> = Record<TDecryptedKeys, string> & Omit<TEncryptedObject, TDecryptedKeys>;

// extracts shared keys from the domain and view types
type EncryptableKeys<D extends Domain, V extends View> = (keyof D &
  ConditionalKeys<D, EncString | null | undefined>) &
  (keyof V & ConditionalKeys<V, string | null | undefined>);

type DomainEncryptableKeys<D extends Domain> = {
  [key in ConditionalKeys<D, EncString | null | undefined>]?: EncString | null | undefined;
};

type ViewEncryptableKeys<V extends View> = {
  [key in ConditionalKeys<V, string | null | undefined>]?: string | null | undefined;
};

// https://contributing.bitwarden.com/architecture/clients/data-model#domain
export default class Domain {
  protected buildDomainModel<D extends Domain>(
    domain: D,
    dataObj: any,
    map: any,
    notEncList: any[] = [],
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
    notEncStringList: any[] = [],
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

  protected async decryptObj<D extends Domain, V extends View>(
    domain: DomainEncryptableKeys<D>,
    viewModel: ViewEncryptableKeys<V>,
    props: EncryptableKeys<D, V>[],
    key: SymmetricCryptoKey | null = null,
    objectContext: string = "No Domain Context",
  ): Promise<V> {
    for (const prop of props) {
      viewModel[prop] =
        (await domain[prop]?.decrypt(
          null,
          key,
          `Property: ${prop as string}; ObjectContext: ${objectContext}`,
        )) ?? null;
    }

    return viewModel as V;
  }
}
