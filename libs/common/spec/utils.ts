// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock, MockProxy } from "jest-mock-extended";

import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";

import { EncryptionType } from "../src/platform/enums";
import { Utils } from "../src/platform/misc/utils";
import { SymmetricCryptoKey } from "../src/platform/models/domain/symmetric-crypto-key";

function newGuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function GetUniqueString(prefix = "") {
  return prefix + "_" + newGuid();
}

export function BuildTestObject<T, K extends keyof T = keyof T>(
  def: Partial<Pick<T, K>> | T,
  constructor?: new () => T,
): T {
  return Object.assign(constructor === null ? {} : new constructor(), def) as T;
}

/** @deprecated */
export function mockEnc(s: string): MockProxy<EncString> {
  const mocked = mock<EncString>();
  return mocked;
}

export function makeEncString(data?: string) {
  data ??= Utils.newGuid();
  return new EncString(EncryptionType.AesCbc256_HmacSha256_B64, data, "test", "test");
}

export function makeStaticByteArray(length: number, start = 0) {
  const arr = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    arr[i] = start + i;
  }
  return arr;
}

/**
 * Creates a symmetric crypto key for use in tests. This is deterministic, i.e. it will produce identical keys
 * for identical argument values. Provide a unique value to the `seed` parameter to create different keys.
 */
export function makeSymmetricCryptoKey<T extends SymmetricCryptoKey>(
  length: 32 | 64 = 64,
  seed = 0,
) {
  return new SymmetricCryptoKey(makeStaticByteArray(length, seed)) as T;
}

/**
 * Use to mock a return value of a static fromJSON method.
 */
export const mockFromJson = (stub: any) => (stub + "_fromJSON") as any;

/**
 * Use to mock a return value of a static fromSdk method.
 */
export const mockFromSdk = (stub: any) => {
  if (typeof stub === "object") {
    return {
      ...stub,
      __fromSdk: true,
    };
  }

  return `${stub}_fromSdk`;
};

export { trackEmissions, awaitAsync } from "@bitwarden/core-test-utils";
