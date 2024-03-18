import { mock } from "jest-mock-extended";
import { firstValueFrom, from } from "rxjs";
import { Jsonify } from "type-fest";

import {
  FakeStateProvider,
  makeEncString,
  mockAccountServiceWith,
  awaitAsync,
} from "../../../../spec";
import { EncString } from "../../../platform/models/domain/enc-string";
import { GENERATOR_DISK } from "../../../platform/state";
import { UserId } from "../../../types/guid";

import { SecretClassifier } from "./secret-classifier";
import { SecretKeyDefinition } from "./secret-key-definition";
import { SecretState } from "./secret-state";
import { UserEncryptor } from "./user-encryptor.abstraction";

type FooBar = { foo: boolean; bar: boolean; date?: Date };
const classifier = SecretClassifier.allSecret<FooBar>();
const options: any = {
  deserializer: (fb: FooBar) => {
    const result: FooBar = { foo: fb.foo, bar: fb.bar };

    if (fb.date) {
      result.date = new Date(fb.date);
    }

    return result;
  },
};
const FOOBAR_VALUE = SecretKeyDefinition.value(GENERATOR_DISK, "fooBar", classifier, options);
const FOOBAR_ARRAY = SecretKeyDefinition.array(GENERATOR_DISK, "fooBar", classifier, options);
const FOOBAR_RECORD = SecretKeyDefinition.record(GENERATOR_DISK, "fooBar", classifier, options);

const SomeUser = "some user" as UserId;

function mockEncryptor(fooBar: FooBar[] = []): UserEncryptor<FooBar> {
  // stores "encrypted values" so that they can be "decrypted" later
  // while allowing the operations to be interleaved.
  const encrypted = new Map<string, Jsonify<FooBar>>(
    fooBar.map((fb) => [toKey(fb).encryptedString, toValue(fb)] as const),
  );

  const result = mock<UserEncryptor<FooBar>>({
    encrypt(value: FooBar, user: UserId) {
      const encString = toKey(value);
      encrypted.set(encString.encryptedString, toValue(value));
      return Promise.resolve(encString);
    },
    decrypt(secret: EncString, userId: UserId) {
      const decString = encrypted.get(toValue(secret.encryptedString));
      return Promise.resolve(decString);
    },
  });

  function toKey(value: FooBar) {
    // `stringify` is only relevant for its uniqueness as a key
    // to `encrypted`.
    return makeEncString(JSON.stringify(value));
  }

  function toValue(value: any) {
    // replace toJSON types with their round-trip equivalents
    return JSON.parse(JSON.stringify(value));
  }

  // typescript pops a false positive about missing `encrypt` and `decrypt`
  // functions, so assert the type manually.
  return result as unknown as UserEncryptor<FooBar>;
}

async function fakeStateProvider() {
  const accountService = mockAccountServiceWith(SomeUser);
  const stateProvider = new FakeStateProvider(accountService);
  return stateProvider;
}

describe("UserEncryptor", () => {
  describe("from", () => {
    it("returns a state store", async () => {
      const provider = await fakeStateProvider();
      const encryptor = mockEncryptor();

      const result = SecretState.from(SomeUser, FOOBAR_VALUE, provider, encryptor);

      expect(result).toBeInstanceOf(SecretState);
    });
  });

  describe("instance", () => {
    it("userId outputs the user input during construction", async () => {
      const provider = await fakeStateProvider();
      const encryptor = mockEncryptor();

      const state = SecretState.from(SomeUser, FOOBAR_VALUE, provider, encryptor);

      expect(state.userId).toEqual(SomeUser);
    });

    it("state$ gets a set value", async () => {
      const provider = await fakeStateProvider();
      const encryptor = mockEncryptor();
      const state = SecretState.from(SomeUser, FOOBAR_VALUE, provider, encryptor);
      const value = { foo: true, bar: false };

      await state.update(() => value);
      await awaitAsync();
      const result = await firstValueFrom(state.state$);

      expect(result).toEqual(value);
    });

    it("state$ gets a set array", async () => {
      const provider = await fakeStateProvider();
      const encryptor = mockEncryptor();
      const state = SecretState.from(SomeUser, FOOBAR_ARRAY, provider, encryptor);
      const array = [
        { foo: true, bar: false },
        { foo: false, bar: true },
      ];

      await state.update(() => array);
      await awaitAsync();
      const result = await firstValueFrom(state.state$);

      expect(result).toStrictEqual(array);
    });

    it("state$ gets a set record", async () => {
      const provider = await fakeStateProvider();
      const encryptor = mockEncryptor();
      const state = SecretState.from(SomeUser, FOOBAR_RECORD, provider, encryptor);
      const record = {
        baz: { foo: true, bar: false },
        biz: { foo: true, bar: false },
      };

      await state.update(() => record);
      await awaitAsync();
      const result = await firstValueFrom(state.state$);

      expect(result).toStrictEqual(record);
    });

    it("combinedState$ gets a set value with the userId", async () => {
      const provider = await fakeStateProvider();
      const encryptor = mockEncryptor();
      const state = SecretState.from(SomeUser, FOOBAR_VALUE, provider, encryptor);
      const value = { foo: true, bar: false };

      await state.update(() => value);
      await awaitAsync();
      const [userId, result] = await firstValueFrom(state.combinedState$);

      expect(result).toEqual(value);
      expect(userId).toEqual(SomeUser);
    });

    it("round-trips json-serializable values", async () => {
      const provider = await fakeStateProvider();
      const encryptor = mockEncryptor();
      const state = SecretState.from(SomeUser, FOOBAR_VALUE, provider, encryptor);
      const value = { foo: true, bar: true, date: new Date(1) };

      await state.update(() => value);
      await awaitAsync();
      const result = await firstValueFrom(state.state$);

      expect(result).toEqual(value);
    });

    it("gets the last set value", async () => {
      const provider = await fakeStateProvider();
      const encryptor = mockEncryptor();
      const state = SecretState.from(SomeUser, FOOBAR_VALUE, provider, encryptor);
      const initialValue = { foo: true, bar: false };
      const replacementValue = { foo: false, bar: false };

      await state.update(() => initialValue);
      await state.update(() => replacementValue);
      await awaitAsync();
      const result = await firstValueFrom(state.state$);

      expect(result).toEqual(replacementValue);
    });

    it("interprets shouldUpdate option", async () => {
      const provider = await fakeStateProvider();
      const encryptor = mockEncryptor();
      const state = SecretState.from(SomeUser, FOOBAR_VALUE, provider, encryptor);
      const initialValue = { foo: true, bar: false };
      const replacementValue = { foo: false, bar: false };

      await state.update(() => initialValue, { shouldUpdate: () => true });
      await state.update(() => replacementValue, { shouldUpdate: () => false });
      const result = await firstValueFrom(state.state$);

      expect(result).toEqual(initialValue);
    });

    it("sets the state to `null` when `update` returns `null`", async () => {
      const provider = await fakeStateProvider();
      const encryptor = mockEncryptor();
      const state = SecretState.from(SomeUser, FOOBAR_VALUE, provider, encryptor);
      const value = { foo: true, bar: false };

      await state.update(() => value);
      await state.update(() => null);
      await awaitAsync();
      const result = await firstValueFrom(state.state$);

      expect(result).toEqual(null);
    });

    it("sets the state to `null` when `update` returns `undefined`", async () => {
      const provider = await fakeStateProvider();
      const encryptor = mockEncryptor();
      const state = SecretState.from(SomeUser, FOOBAR_VALUE, provider, encryptor);
      const value = { foo: true, bar: false };

      await state.update(() => value);
      await state.update(() => undefined);
      await awaitAsync();
      const result = await firstValueFrom(state.state$);

      expect(result).toEqual(null);
    });

    it("sends rxjs observables into the shouldUpdate method", async () => {
      const provider = await fakeStateProvider();
      const encryptor = mockEncryptor();
      const state = SecretState.from(SomeUser, FOOBAR_VALUE, provider, encryptor);
      const combinedWith$ = from([1]);
      let combinedShouldUpdate = 0;

      await state.update((value) => value, {
        shouldUpdate: (_, combined) => {
          combinedShouldUpdate = combined;
          return true;
        },
        combineLatestWith: combinedWith$,
      });

      expect(combinedShouldUpdate).toEqual(1);
    });

    it("sends rxjs observables into the update method", async () => {
      const provider = await fakeStateProvider();
      const encryptor = mockEncryptor();
      const state = SecretState.from(SomeUser, FOOBAR_VALUE, provider, encryptor);
      const combinedWith$ = from([1]);
      let combinedUpdate = 0;

      await state.update(
        (value, combined) => {
          combinedUpdate = combined;
          return value;
        },
        {
          combineLatestWith: combinedWith$,
        },
      );

      expect(combinedUpdate).toEqual(1);
    });
  });
});
