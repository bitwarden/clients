import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import {
  mockAccountServiceWith,
  FakeStateProvider,
  awaitAsync,
  trackEmissions,
} from "../../../spec";
import { GENERATOR_DISK, UserKeyDefinition } from "../../platform/state";
import { UserId } from "../../types/guid";

import { BufferedKeyDefinition } from "./buffered-key-definition";
import { BufferedState } from "./buffered-state";

const SomeUser = "SomeUser" as UserId;
const accountService = mockAccountServiceWith(SomeUser);
type SomeType = { foo: boolean; bar: boolean };

const SOME_KEY = new UserKeyDefinition<SomeType>(GENERATOR_DISK, "fooBar", {
  deserializer: (jsonValue) => jsonValue as SomeType,
  clearOn: [],
});
const BUFFER_KEY = new BufferedKeyDefinition<SomeType>(GENERATOR_DISK, "fooBar_buffer", {
  deserializer: (jsonValue) => jsonValue as SomeType,
  clearOn: [],
});

describe("BufferedState", () => {
  describe("state$", function () {
    it("reads from the output state", async () => {
      const provider = new FakeStateProvider(accountService);
      const value = { foo: true, bar: false };
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      await outputState.update(() => value);
      const bufferedState = new BufferedState(provider, BUFFER_KEY, outputState);

      const result = await firstValueFrom(bufferedState.state$);

      expect(result).toEqual(value);
    });

    it("updates when the output state updates", async () => {
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const firstValue = { foo: true, bar: false };
      const secondValue = { foo: true, bar: true };
      await outputState.update(() => firstValue);
      const bufferedState = new BufferedState(provider, BUFFER_KEY, outputState);

      const result = trackEmissions(bufferedState.state$);
      await outputState.update(() => secondValue);
      await awaitAsync();

      expect(result).toEqual([firstValue, secondValue]);
    });

    // this test is important for data migrations, which set
    // the buffered state without using the `BufferedState` abstraction.
    it.each([[null], [undefined]])(
      "reads from the output state when the buffered state is '%p'",
      async (bufferValue) => {
        const provider = new FakeStateProvider(accountService);
        const outputState = provider.getUser(SomeUser, SOME_KEY);
        const firstValue = { foo: true, bar: false };
        await outputState.update(() => firstValue);
        const bufferedState = new BufferedState(provider, BUFFER_KEY, outputState);
        await provider.setUserState(BUFFER_KEY.toKeyDefinition(), bufferValue, SomeUser);

        const result = await firstValueFrom(bufferedState.state$);

        expect(result).toEqual(firstValue);
      },
    );

    // also important for data migrations
    it("rolls over pending values from the buffered state immediately by default", async () => {
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const initialValue = { foo: true, bar: false };
      await outputState.update(() => initialValue);
      const bufferedState = new BufferedState(provider, BUFFER_KEY, outputState);
      const bufferedValue = { foo: true, bar: true };
      await provider.setUserState(BUFFER_KEY.toKeyDefinition(), bufferedValue, SomeUser);

      const result = await trackEmissions(bufferedState.state$);
      await awaitAsync();

      expect(result).toEqual([initialValue, bufferedValue]);
    });

    // also important for data migrations
    it("reads from the output state when its dependency is false", async () => {
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const value = { foo: true, bar: false };
      await outputState.update(() => value);
      const dependency = new BehaviorSubject<boolean>(false).asObservable();
      const bufferedState = new BufferedState(provider, BUFFER_KEY, outputState, dependency);
      await provider.setUserState(BUFFER_KEY.toKeyDefinition(), { foo: true, bar: true }, SomeUser);

      const result = await firstValueFrom(bufferedState.state$);

      expect(result).toEqual(value);
    });

    // also important for data migrations
    it("overwrites the output state when its dependency emits a truthy value", async () => {
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const firstValue = { foo: true, bar: false };
      await outputState.update(() => firstValue);
      const dependency = new BehaviorSubject<boolean>(false);
      const bufferedState = new BufferedState(
        provider,
        BUFFER_KEY,
        outputState,
        dependency.asObservable(),
      );
      const bufferedValue = { foo: true, bar: true };
      await provider.setUserState(BUFFER_KEY.toKeyDefinition(), bufferedValue, SomeUser);

      const result = trackEmissions(bufferedState.state$);
      dependency.next(true);
      await awaitAsync();

      expect(result).toEqual([firstValue, bufferedValue]);
    });

    it("overwrites the output state when shouldOverwrite returns a truthy value", async () => {
      const bufferedKey = new BufferedKeyDefinition<SomeType>(GENERATOR_DISK, "fooBar_buffer", {
        deserializer: (jsonValue) => jsonValue as SomeType,
        shouldOverwrite: () => true,
        clearOn: [],
      });
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const initialValue = { foo: true, bar: false };
      await outputState.update(() => initialValue);
      const bufferedState = new BufferedState(provider, bufferedKey, outputState);
      const bufferedValue = { foo: true, bar: true };
      await provider.setUserState(bufferedKey.toKeyDefinition(), bufferedValue, SomeUser);

      const result = await trackEmissions(bufferedState.state$);
      await awaitAsync();

      expect(result).toEqual([initialValue, bufferedValue]);
    });

    it("reads from the output state when shouldOverwrite returns a falsy value", async () => {
      const bufferedKey = new BufferedKeyDefinition<SomeType>(GENERATOR_DISK, "fooBar_buffer", {
        deserializer: (jsonValue) => jsonValue as SomeType,
        shouldOverwrite: () => false,
        clearOn: [],
      });
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const value = { foo: true, bar: false };
      await outputState.update(() => value);
      const bufferedState = new BufferedState(provider, bufferedKey, outputState);
      await provider.setUserState(
        bufferedKey.toKeyDefinition(),
        { foo: true, bar: true },
        SomeUser,
      );

      const result = await firstValueFrom(bufferedState.state$);

      expect(result).toEqual(value);
    });

    it("replaces the output state when shouldOverwrite transforms its dependency to a truthy value", async () => {
      const bufferedKey = new BufferedKeyDefinition<SomeType>(GENERATOR_DISK, "fooBar_buffer", {
        deserializer: (jsonValue) => jsonValue as SomeType,
        shouldOverwrite: (dependency) => !dependency,
        clearOn: [],
      });
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const firstValue = { foo: true, bar: false };
      await outputState.update(() => firstValue);
      const dependency = new BehaviorSubject<boolean>(true);
      const bufferedState = new BufferedState(
        provider,
        bufferedKey,
        outputState,
        dependency.asObservable(),
      );
      const bufferedValue = { foo: true, bar: true };
      await provider.setUserState(bufferedKey.toKeyDefinition(), bufferedValue, SomeUser);

      const result = trackEmissions(bufferedState.state$);
      dependency.next(false);
      await awaitAsync();

      expect(result).toEqual([firstValue, bufferedValue]);
    });
  });

  describe("userId", () => {
    const AnotherUser = "anotherUser" as UserId;

    it.each([[SomeUser], [AnotherUser]])("gets the userId", (userId) => {
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(userId, SOME_KEY);
      const bufferedState = new BufferedState(provider, BUFFER_KEY, outputState);

      const result = bufferedState.userId;

      expect(result).toEqual(userId);
    });
  });

  describe("update", () => {
    it("updates state$", async () => {
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const firstValue = { foo: true, bar: false };
      const secondValue = { foo: true, bar: true };
      await outputState.update(() => firstValue);
      const bufferedState = new BufferedState(provider, BUFFER_KEY, outputState);

      const result = trackEmissions(bufferedState.state$);
      await bufferedState.update(() => secondValue);
      await awaitAsync();

      expect(result).toEqual([firstValue, secondValue]);
    });

    it("respects update options", async () => {
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const firstValue = { foo: true, bar: false };
      const secondValue = { foo: true, bar: true };
      await outputState.update(() => firstValue);
      const bufferedState = new BufferedState(provider, BUFFER_KEY, outputState);

      const result = trackEmissions(bufferedState.state$);
      await bufferedState.update(() => secondValue, {
        shouldUpdate: (_, latest) => latest,
        combineLatestWith: of(false),
      });
      await awaitAsync();

      expect(result).toEqual([firstValue]);
    });
  });

  describe("buffer", () => {
    it("updates state$ once per overwrite", async () => {
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const firstValue = { foo: true, bar: false };
      const secondValue = { foo: true, bar: true };
      await outputState.update(() => firstValue);
      const bufferedState = new BufferedState(provider, BUFFER_KEY, outputState);

      const result = trackEmissions(bufferedState.state$);
      await bufferedState.buffer(secondValue);
      await awaitAsync();

      expect(result).toEqual([firstValue, secondValue]);
    });

    it("emits the output state when its dependency is false", async () => {
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const firstValue = { foo: true, bar: false };
      await outputState.update(() => firstValue);
      const dependency = new BehaviorSubject<boolean>(false);
      const bufferedState = new BufferedState(
        provider,
        BUFFER_KEY,
        outputState,
        dependency.asObservable(),
      );
      const bufferedValue = { foo: true, bar: true };

      const result = trackEmissions(bufferedState.state$);
      await bufferedState.buffer(bufferedValue);
      await awaitAsync();

      expect(result).toEqual([firstValue]);
    });

    it("replaces the output state when its dependency becomes true", async () => {
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const firstValue = { foo: true, bar: false };
      await outputState.update(() => firstValue);
      const dependency = new BehaviorSubject<boolean>(false);
      const bufferedState = new BufferedState(
        provider,
        BUFFER_KEY,
        outputState,
        dependency.asObservable(),
      );
      const bufferedValue = { foo: true, bar: true };

      const result = trackEmissions(bufferedState.state$);
      await bufferedState.buffer(bufferedValue);
      dependency.next(true);
      await awaitAsync();

      expect(result).toEqual([firstValue, bufferedValue]);
    });

    it.each([[null], [undefined]])("ignores `%p`", async (bufferedValue) => {
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const firstValue = { foo: true, bar: false };
      await outputState.update(() => firstValue);
      const bufferedState = new BufferedState(provider, BUFFER_KEY, outputState);

      const result = trackEmissions(bufferedState.state$);
      await bufferedState.buffer(bufferedValue);
      await awaitAsync();

      expect(result).toEqual([firstValue]);
    });

    it("discards the buffered data when isValid returns false", async () => {
      const bufferedKey = new BufferedKeyDefinition<SomeType>(GENERATOR_DISK, "fooBar_buffer", {
        deserializer: (jsonValue) => jsonValue as SomeType,
        isValid: () => Promise.resolve(false),
        clearOn: [],
      });
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const firstValue = { foo: true, bar: false };
      await outputState.update(() => firstValue);
      const bufferedState = new BufferedState(provider, bufferedKey, outputState);

      const stateResult = trackEmissions(bufferedState.state$);
      await bufferedState.buffer({ foo: true, bar: true });
      await awaitAsync();
      const bufferedResult = await firstValueFrom(bufferedState.bufferedState$);

      expect(stateResult).toEqual([firstValue]);
      expect(bufferedResult).toBeNull();
    });

    it("overwrites the output when isValid returns true", async () => {
      const bufferedKey = new BufferedKeyDefinition<SomeType>(GENERATOR_DISK, "fooBar_buffer", {
        deserializer: (jsonValue) => jsonValue as SomeType,
        isValid: () => Promise.resolve(true),
        clearOn: [],
      });
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const firstValue = { foo: true, bar: false };
      await outputState.update(() => firstValue);
      const bufferedState = new BufferedState(provider, bufferedKey, outputState);
      const bufferedValue = { foo: true, bar: true };

      const result = trackEmissions(bufferedState.state$);
      await bufferedState.buffer(bufferedValue);
      await awaitAsync();

      expect(result).toEqual([firstValue, bufferedValue]);
    });

    it("maps the buffered data when it overwrites the state", async () => {
      const mappedValue = { foo: true, bar: true };
      const bufferedKey = new BufferedKeyDefinition<SomeType>(GENERATOR_DISK, "fooBar_buffer", {
        deserializer: (jsonValue) => jsonValue as SomeType,
        map: () => Promise.resolve(mappedValue),
        clearOn: [],
      });
      const provider = new FakeStateProvider(accountService);
      const outputState = provider.getUser(SomeUser, SOME_KEY);
      const firstValue = { foo: true, bar: false };
      await outputState.update(() => firstValue);
      const bufferedState = new BufferedState(provider, bufferedKey, outputState);

      const result = trackEmissions(bufferedState.state$);
      await bufferedState.buffer({ foo: false, bar: false });
      await awaitAsync();

      expect(result).toEqual([firstValue, mappedValue]);
    });
  });
});
