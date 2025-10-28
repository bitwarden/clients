import { ConditionalExcept, ConditionalKeys } from "type-fest";

import { UserId } from "@bitwarden/user-core";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import { View } from "../../../models/view/view";

import { SymmetricCryptoKey } from "./symmetric-crypto-key";

/** @deprecated */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type EncStringKeys<T> = ConditionalKeys<ConditionalExcept<T, Function>, EncString>;
/** @deprecated */
export type DecryptedObject<
  TEncryptedObject,
  TDecryptedKeys extends EncStringKeys<TEncryptedObject>,
> = Record<TDecryptedKeys, string> & Omit<TEncryptedObject, TDecryptedKeys>;

// extracts shared keys from the domain and view types
/** @deprecated */
type EncryptableKeys<D extends Domain, V extends View> = (keyof D &
  ConditionalKeys<D, EncString | null | undefined>) &
  (keyof V & ConditionalKeys<V, string | null | undefined>);

/** @deprecated */
type DomainEncryptableKeys<D extends Domain> = {
  [key in ConditionalKeys<D, EncString | null | undefined>]?: EncString | null | undefined;
};

/** @deprecated */
type ViewEncryptableKeys<V extends View> = {
  [key in ConditionalKeys<V, string | null | undefined>]?: string | null | undefined;
};

// https://contributing.bitwarden.com/architecture/clients/data-model#domain
/** @deprecated encryption and decryption of domain objects should be moved to the SDK */
export default class Domain {
  /** @deprecated */
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

  /** @deprecated */
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

  /** @deprecated */
  protected async decryptObj<D extends Domain, V extends View>(
    domain: DomainEncryptableKeys<D>,
    viewModel: ViewEncryptableKeys<V>,
    props: EncryptableKeys<D, V>[],
    orgId: string | null,
    key: SymmetricCryptoKey | null = null,
    objectContext: string = "No Domain Context",
    // Unused until a follow-up PR in the PR-chain merges
    userId: UserId | null = null,
  ): Promise<V> {
    for (const prop of props) {
      viewModel[prop] =
        (await domain[prop]?.decrypt(
          orgId,
          key,
          `Property: ${prop as string}; ObjectContext: ${objectContext}`,
        )) ?? null;
    }

    return viewModel as V;
  }
}
