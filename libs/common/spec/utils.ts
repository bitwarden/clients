// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock, MockProxy } from "jest-mock-extended";
import { Observable } from "rxjs";

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

export function mockEnc(s: string): MockProxy<EncString> {
  const mocked = mock<EncString>();
  mocked.decrypt.mockResolvedValue(s);

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

/**
 * Tracks the emissions of the given observable.
 *
 * Call this function before you expect any emissions and then use code that will cause the observable to emit values,
 * then assert after all expected emissions have occurred.
 * @param observable
 * @returns An array that will be populated with all emissions of the observable.
 */
export function trackEmissions<T>(observable: Observable<T>): T[] {
  const emissions: T[] = [];
  observable.subscribe((value) => {
    switch (value) {
      case undefined:
      case null:
        emissions.push(value);
        return;
      default:
        // process by type
        break;
    }

    switch (typeof value) {
      case "string":
      case "number":
      case "boolean":
        emissions.push(value);
        break;
      case "symbol":
        // Cheating types to make symbols work at all
        emissions.push(value.toString() as T);
        break;
      default: {
        emissions.push(clone(value));
      }
    }
  });
  return emissions;
}

function clone(value: any): any {
  if (global.structuredClone != undefined) {
    return structuredClone(value);
  } else {
    return JSON.parse(JSON.stringify(value));
  }
}

export async function awaitAsync(ms = 1) {
  if (ms < 1) {
    await Promise.resolve();
  } else {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
