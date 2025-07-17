import { ConditionalExcept, ConditionalKeys, Constructor } from "type-fest";

import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
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
  ConditionalKeys<D, EncString | null>) &
  (keyof V & ConditionalKeys<V, string | null>);

type DomainEncryptableKeys<D extends Domain> = {
  [key in ConditionalKeys<D, EncString | null>]: EncString | null;
};

type ViewEncryptableKeys<V extends View> = {
  [key in ConditionalKeys<V, string | null>]: string | null;
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
    orgId: string | null,
    key: SymmetricCryptoKey | null = null,
    objectContext: string = "No Domain Context",
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

  /**
   * Decrypts the requested properties of the domain object with the provided key and encrypt service.
   *
   * If a property is null, the result will be null.
   * @see {@link EncString.decryptWithKey} for more details on decryption behavior.
   *
   * @param encryptedProperties The properties to decrypt. Type restricted to EncString properties of the domain object.
   * @param key The key to use for decryption.
   * @param encryptService The encryption service to use for decryption.
   * @param _ The constructor of the domain object. Used for type inference if the domain object is not automatically inferred.
   * @returns An object with the requested properties decrypted and the rest of the domain object untouched.
   */
  protected async decryptObjWithKey<
    TThis extends Domain,
    const TEncryptedKeys extends EncStringKeys<TThis>,
  >(
    this: TThis,
    encryptedProperties: TEncryptedKeys[],
    key: SymmetricCryptoKey,
    encryptService: EncryptService,
    _: Constructor<TThis> = this.constructor as Constructor<TThis>,
    objectContext: string = "No Domain Context",
  ): Promise<DecryptedObject<TThis, TEncryptedKeys>> {
    const decryptedObjects = [];

    for (const prop of encryptedProperties) {
      const value = this[prop] as EncString;
      const decrypted = await this.decryptProperty(
        prop,
        value,
        key,
        encryptService,
        `Property: ${prop.toString()}; ObjectContext: ${objectContext}`,
      );
      decryptedObjects.push(decrypted);
    }

    const decryptedObject = decryptedObjects.reduce(
      (acc, obj) => {
        return { ...acc, ...obj };
      },
      { ...this },
    );
    return decryptedObject as DecryptedObject<TThis, TEncryptedKeys>;
  }

  private async decryptProperty<const TEncryptedKeys extends EncStringKeys<this>>(
    propertyKey: TEncryptedKeys,
    value: EncString,
    key: SymmetricCryptoKey,
    encryptService: EncryptService,
    decryptTrace: string,
  ) {
    let decrypted: string | null = null;
    if (value) {
      decrypted = await value.decryptWithKey(key, encryptService, decryptTrace);
    }
    return {
      [propertyKey]: decrypted,
    };
  }
}
