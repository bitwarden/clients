// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BehaviorSubject, of, Subject } from "rxjs";

import {
  awaitAsync,
  FakeAccountService,
  FakeStateProvider,
  ObservableTracker,
} from "../../../spec";
import { Account } from "../../auth/abstractions/account.service";
import { GENERATOR_DISK, UserKeyDefinition } from "../../platform/state";
import { UserId } from "../../types/guid";
import { LegacyEncryptorProvider } from "../cryptography/legacy-encryptor-provider";
import { UserEncryptor } from "../cryptography/user-encryptor.abstraction";
import { disabledSemanticLoggerProvider } from "../log";
import { PrivateClassifier } from "../private-classifier";
import { StateConstraints } from "../types";

import { ObjectKey } from "./object-key";
import { UserStateSubject } from "./user-state-subject";

const SomeUser = "some user" as UserId;
const SomeAccount = {
  id: SomeUser,
  email: "someone@example.com",
  emailVerified: true,
  name: "Someone",
};
const SomeAccount$ = new BehaviorSubject<Account>(SomeAccount);

const SomeOtherAccount = {
  id: "some other user" as UserId,
  email: "someone@example.com",
  emailVerified: true,
  name: "Someone",
};

type TestType = { foo: string };
const SomeKey = new UserKeyDefinition<TestType>(GENERATOR_DISK, "TestKey", {
  deserializer: (d) => d as TestType,
  clearOn: [],
});

const SomeObjectKeyDefinition = new UserKeyDefinition<unknown>(GENERATOR_DISK, "TestKey", {
  deserializer: (d) => d as unknown,
  clearOn: ["logout"],
});

const SomeObjectKey = {
  target: "object",
  key: SomeObjectKeyDefinition.key,
  state: SomeObjectKeyDefinition.stateDefinition,
  classifier: new PrivateClassifier(),
  format: "classified",
  options: {
    deserializer: (d) => d as TestType,
    clearOn: SomeObjectKeyDefinition.clearOn,
  },
} satisfies ObjectKey<TestType>;

const SomeEncryptor: UserEncryptor = {
  userId: SomeUser,

  encrypt(secret) {
    const tmp: any = secret;
    return Promise.resolve({ foo: `encrypt(${tmp.foo})` } as any);
  },

  decrypt(secret) {
    const tmp: any = JSON.parse(secret.encryptedString);
    return Promise.resolve({ foo: `decrypt(${tmp.foo})` } as any);
  },
};

const SomeAccountService = new FakeAccountService({
  [SomeUser]: SomeAccount,
});

const SomeStateProvider = new FakeStateProvider(SomeAccountService);

const SomeProvider = {
  encryptor: {
    userEncryptor$: jest.fn(() => {
      return new BehaviorSubject({ encryptor: SomeEncryptor, userId: SomeUser }).asObservable();
    }),
    organizationEncryptor$() {
      throw new Error("`organizationEncryptor$` should never be invoked.");
    },
  } as LegacyEncryptorProvider,
  state: SomeStateProvider,
  log: disabledSemanticLoggerProvider,
};

function fooMaxLength(maxLength: number): StateConstraints<TestType> {
  return Object.freeze({
    constraints: { foo: { maxLength } },
    adjust: function (state: TestType): TestType {
      return {
        foo: state.foo.slice(0, this.constraints.foo.maxLength),
      };
    },
    fix: function (state: TestType): TestType {
      return {
        foo: `finalized|${state.foo.slice(0, this.constraints.foo.maxLength)}`,
      };
    },
  });
}

const DynamicFooMaxLength = Object.freeze({
  expected: fooMaxLength(0),
  calibrate(state: TestType) {
    return this.expected;
  },
});

const SomeKeySomeUserInitialValue = Object.freeze({ foo: "init" });

describe("UserStateSubject", () => {
  beforeEach(async () => {
    await SomeStateProvider.setUserState(SomeKey, SomeKeySomeUserInitialValue, SomeUser);
  });

  describe("dependencies", () => {
    it("ignores repeated when$ emissions", async () => {
      // this test looks for `nextValue` because a subscription isn't necessary for
      // the subject to update
      const nextValue = jest.fn((_, next) => next);
      const when$ = new BehaviorSubject(true);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        nextValue,
        when$,
      });

      // the interleaved await asyncs are only necessary b/c `nextValue` is called asynchronously
      subject.next({ foo: "next" });
      await awaitAsync();
      when$.next(true);
      await awaitAsync();
      when$.next(true);
      when$.next(true);
      await awaitAsync();

      expect(nextValue).toHaveBeenCalledTimes(1);
    });

    it("errors when account$ changes accounts", async () => {
      const account$ = new BehaviorSubject<Account>(SomeAccount);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$,
      });
      let error: any = null;
      subject.subscribe({
        error(e: unknown) {
          error = e;
        },
      });

      account$.next(SomeOtherAccount);
      await awaitAsync();

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(/UserStateSubject\(generator, TestKey\) \{ account\$ \}/);
    });

    it("waits for account$", async () => {
      await SomeStateProvider.setUserState(
        SomeObjectKeyDefinition,
        { id: null, secret: '{"foo":"init"}', disclosed: {} } as unknown,
        SomeUser,
      );
      const account$ = new Subject<Account>();
      const subject = new UserStateSubject(SomeObjectKey, SomeProvider, { account$ });

      const results = [] as any[];
      subject.subscribe((v) => results.push(v));
      // precondition: no immediate emission upon subscribe
      expect(results).toEqual([]);

      account$.next(SomeAccount);
      await awaitAsync();

      expect(results).toEqual([{ foo: "decrypt(init)" }]);
    });

    it("waits for constraints$", async () => {
      const constraints$ = new Subject<StateConstraints<TestType>>();
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const results = [] as any[];
      subject.subscribe((v) => results.push(v));

      constraints$.next(fooMaxLength(3));
      await awaitAsync();

      expect(results).toEqual([{ foo: "ini" }]);
    });
  });

  describe("next", () => {
    it("emits the next value", async () => {
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$: SomeAccount$ });
      const expected: TestType = { foo: "next" };

      let actual: TestType = null;
      subject.subscribe((value) => {
        actual = value;
      });
      subject.next(expected);
      await awaitAsync();

      expect(actual).toEqual(expected);
    });

    it("ceases emissions once complete", async () => {
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$: SomeAccount$ });
      let actual: TestType = null;
      subject.subscribe((value) => {
        actual = value;
      });
      await awaitAsync();

      subject.complete();
      subject.next({ foo: "ignored" });
      await awaitAsync();

      expect(actual).toEqual(SomeKeySomeUserInitialValue);
    });

    it("evaluates shouldUpdate", async () => {
      const shouldUpdate = jest.fn(() => true);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        shouldUpdate,
      });

      const nextVal: TestType = { foo: "next" };
      subject.next(nextVal);
      await awaitAsync();

      expect(shouldUpdate).toHaveBeenCalledWith(SomeKeySomeUserInitialValue, nextVal, null);
    });

    it("evaluates shouldUpdate with a dependency", async () => {
      const shouldUpdate = jest.fn(() => true);
      const dependencyValue = { bar: "dependency" };
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        shouldUpdate,
        dependencies$: of(dependencyValue),
      });

      const nextVal: TestType = { foo: "next" };
      subject.next(nextVal);
      await awaitAsync();

      expect(shouldUpdate).toHaveBeenCalledWith(
        SomeKeySomeUserInitialValue,
        nextVal,
        dependencyValue,
      );
    });

    it("emits a value when shouldUpdate returns `true`", async () => {
      const shouldUpdate = jest.fn(() => true);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        shouldUpdate,
      });
      const expected: TestType = { foo: "next" };

      let actual: TestType = null;
      subject.subscribe((value) => {
        actual = value;
      });
      subject.next(expected);
      await awaitAsync();

      expect(actual).toEqual(expected);
    });

    it("retains the current value when shouldUpdate returns `false`", async () => {
      const shouldUpdate = jest.fn(() => false);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        shouldUpdate,
      });

      subject.next({ foo: "next" });
      await awaitAsync();
      let actual: TestType = null;
      subject.subscribe((value) => {
        actual = value;
      });

      expect(actual).toEqual(SomeKeySomeUserInitialValue);
    });

    it("evaluates nextValue", async () => {
      const nextValue = jest.fn((_, next) => next);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        nextValue,
      });

      const nextVal: TestType = { foo: "next" };
      subject.next(nextVal);
      await awaitAsync();

      expect(nextValue).toHaveBeenCalledWith(SomeKeySomeUserInitialValue, nextVal, null);
    });

    it("evaluates nextValue with a dependency", async () => {
      const nextValue = jest.fn((_, next) => next);
      const dependencyValue = { bar: "dependency" };
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        nextValue,
        dependencies$: of(dependencyValue),
      });

      const nextVal: TestType = { foo: "next" };
      subject.next(nextVal);
      await awaitAsync();

      expect(nextValue).toHaveBeenCalledWith(SomeKeySomeUserInitialValue, nextVal, dependencyValue);
    });

    it("evaluates nextValue when when$ is true", async () => {
      // this test looks for `nextValue` because a subscription isn't necessary for
      // the subject to update
      const nextValue = jest.fn((_, next) => next);
      const when$ = new BehaviorSubject(true);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        nextValue,
        when$,
      });

      const nextVal: TestType = { foo: "next" };
      subject.next(nextVal);
      await awaitAsync();

      expect(nextValue).toHaveBeenCalled();
    });

    it("waits to evaluate nextValue until when$ is true", async () => {
      // this test looks for `nextValue` because a subscription isn't necessary for
      // the subject to update.
      const nextValue = jest.fn((_, next) => next);
      const when$ = new BehaviorSubject(false);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        nextValue,
        when$,
      });

      const nextVal: TestType = { foo: "next" };
      subject.next(nextVal);
      await awaitAsync();
      expect(nextValue).not.toHaveBeenCalled();

      when$.next(true);
      await awaitAsync();
      expect(nextValue).toHaveBeenCalled();
    });

    it("waits to evaluate `UserState.update` until account$ emits", async () => {
      // this test looks for `nextValue` because a subscription isn't necessary for
      // the subject to update.
      const account$ = new Subject<Account>();
      const nextValue = jest.fn((_, pending) => pending);
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$, nextValue });

      // precondition: subject doesn't update after `next`
      const nextVal: TestType = { foo: "next" };
      subject.next(nextVal);
      await awaitAsync();
      expect(nextValue).not.toHaveBeenCalled();

      account$.next(SomeAccount);
      await awaitAsync();

      expect(nextValue).toHaveBeenCalledWith(SomeKeySomeUserInitialValue, { foo: "next" }, null);
    });

    it("applies dynamic constraints", async () => {
      const constraints$ = new BehaviorSubject(DynamicFooMaxLength);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject);
      const expected: TestType = { foo: "next" };
      const emission = tracker.expectEmission();

      subject.next(expected);
      const actual = await emission;

      expect(actual).toEqual({ foo: "" });
    });

    it("applies constraints$ on next", async () => {
      const constraints$ = new BehaviorSubject(fooMaxLength(2));
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject);

      subject.next({ foo: "next" });
      const [, result] = await tracker.pauseUntilReceived(2);

      expect(result).toEqual({ foo: "ne" });
    });

    it("applies latest constraints$ on next", async () => {
      const constraints$ = new BehaviorSubject(fooMaxLength(2));
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject);

      constraints$.next(fooMaxLength(3));
      subject.next({ foo: "next" });
      const [, , result] = await tracker.pauseUntilReceived(3);

      expect(result).toEqual({ foo: "nex" });
    });

    it("waits for constraints$", async () => {
      const constraints$ = new Subject<StateConstraints<TestType>>();
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const results: any[] = [];
      subject.subscribe((r) => {
        results.push(r);
      });

      subject.next({ foo: "next" });
      constraints$.next(fooMaxLength(3));
      await awaitAsync();
      // `init` is also waiting and is processed before `next`
      const [, nextResult] = results;

      expect(nextResult).toEqual({ foo: "nex" });
    });

    it("uses the last-emitted value from constraints$ when constraints$ errors", async () => {
      const constraints$ = new BehaviorSubject(fooMaxLength(3));
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject);

      constraints$.error({ some: "error" });
      subject.next({ foo: "next" });
      const [, nextResult] = await tracker.pauseUntilReceived(1);

      expect(nextResult).toEqual({ foo: "nex" });
    });

    it("uses the last-emitted value from constraints$ when constraints$ completes", async () => {
      const constraints$ = new BehaviorSubject(fooMaxLength(3));
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject);

      constraints$.complete();
      subject.next({ foo: "next" });
      const [, nextResult] = await tracker.pauseUntilReceived(1);

      expect(nextResult).toEqual({ foo: "nex" });
    });
  });

  describe("error", () => {
    it("emits errors", async () => {
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$: SomeAccount$ });
      const expected: TestType = { foo: "error" };

      let actual: TestType = null;
      subject.subscribe({
        error: (value: unknown) => {
          actual = value as any;
        },
      });
      subject.error(expected);
      await awaitAsync();

      expect(actual).toEqual(expected);
    });

    it("ceases emissions once errored", async () => {
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$: SomeAccount$ });

      let actual: TestType = null;
      subject.subscribe({
        error: (value: unknown) => {
          actual = value as any;
        },
      });
      subject.error("expectedError");
      subject.error("ignored");
      await awaitAsync();

      expect(actual).toEqual("expectedError");
    });

    it("ceases emissions once complete", async () => {
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$: SomeAccount$ });

      let shouldNotRun = false;
      subject.subscribe({
        error: () => {
          shouldNotRun = true;
        },
      });
      subject.complete();
      subject.error("ignored");
      await awaitAsync();

      expect(shouldNotRun).toBeFalsy();
    });
  });

  describe("complete", () => {
    it("emits completes", async () => {
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$: SomeAccount$ });

      let actual = false;
      subject.subscribe({
        complete: () => {
          actual = true;
        },
      });
      subject.complete();
      await awaitAsync();

      expect(actual).toBeTruthy();
    });

    it("ceases emissions once errored", async () => {
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$: SomeAccount$ });

      let shouldNotRun = false;
      subject.subscribe({
        complete: () => {
          shouldNotRun = true;
        },
        // prevent throw
        error: () => {},
      });
      subject.error("occurred");
      subject.complete();
      await awaitAsync();

      expect(shouldNotRun).toBeFalsy();
    });

    it("ceases emissions once complete", async () => {
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$: SomeAccount$ });

      let timesRun = 0;
      subject.subscribe({
        complete: () => {
          timesRun++;
        },
      });
      subject.complete();
      subject.complete();
      await awaitAsync();

      expect(timesRun).toEqual(1);
    });
  });

  describe("subscribe", () => {
    it("applies constraints$ on init", async () => {
      const constraints$ = new BehaviorSubject(fooMaxLength(2));
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject);

      const [result] = await tracker.pauseUntilReceived(1);

      expect(result).toEqual({ foo: "in" });
    });

    it("applies constraints$ on constraints$ emission", async () => {
      const constraints$ = new BehaviorSubject(fooMaxLength(2));
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject);

      constraints$.next(fooMaxLength(1));
      const [, result] = await tracker.pauseUntilReceived(2);

      expect(result).toEqual({ foo: "i" });
    });

    it("completes when account$ completes", async () => {
      const account$ = new BehaviorSubject(SomeAccount);
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$ });

      let actual = false;
      subject.subscribe({
        complete: () => {
          actual = true;
        },
      });
      account$.complete();
      await awaitAsync();

      expect(actual).toBeTruthy();
    });

    it("completes when when$ completes", async () => {
      const when$ = new BehaviorSubject(true);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        when$,
      });

      let actual = false;
      subject.subscribe({
        complete: () => {
          actual = true;
        },
      });
      when$.complete();
      await awaitAsync();

      expect(actual).toBeTruthy();
    });

    // FIXME: add test for `this.state.catch` once `FakeSingleUserState` supports
    // simulated errors

    it("errors when account$ changes", async () => {
      const account$ = new BehaviorSubject(SomeAccount);
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$ });

      let error = false;
      subject.subscribe({
        error: (e: unknown) => {
          error = e as any;
        },
      });
      account$.next(SomeOtherAccount);
      await awaitAsync();

      expect(error).toBeInstanceOf(Error);
    });

    it("errors when account$ errors", async () => {
      const account$ = new BehaviorSubject(SomeAccount);
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$ });
      const expected = { error: "description" };

      let actual = false;
      subject.subscribe({
        error: (e: unknown) => {
          actual = e as any;
        },
      });
      account$.error(expected);
      await awaitAsync();

      expect(actual).toEqual(expected);
    });

    it("errors when when$ errors", async () => {
      const when$ = new BehaviorSubject(true);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        when$,
      });
      const expected = { error: "description" };

      let actual = false;
      subject.subscribe({
        error: (e: unknown) => {
          actual = e as any;
        },
      });
      when$.error(expected);
      await awaitAsync();

      expect(actual).toEqual(expected);
    });
  });

  describe("withConstraints$", () => {
    it("emits the next value with an empty constraint", async () => {
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$: SomeAccount$ });
      const tracker = new ObservableTracker(subject.withConstraints$);
      const expected: TestType = { foo: "next" };
      const emission = tracker.expectEmission();

      subject.next(expected);
      const actual = await emission;

      expect(actual.state).toEqual(expected);
      expect(actual.constraints).toEqual({});
    });

    it("ceases emissions once the subject completes", async () => {
      const subject = new UserStateSubject(SomeKey, SomeProvider, { account$: SomeAccount$ });
      const tracker = new ObservableTracker(subject.withConstraints$);

      subject.complete();
      subject.next({ foo: "ignored" });
      const [result] = await tracker.pauseUntilReceived(1);

      expect(result.state).toEqual(SomeKeySomeUserInitialValue);
      expect(tracker.emissions.length).toEqual(1);
    });

    it("emits constraints$ on constraints$ emission", async () => {
      const constraints$ = new BehaviorSubject(fooMaxLength(2));
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject.withConstraints$);
      const expected = fooMaxLength(1);
      const emission = tracker.expectEmission();

      constraints$.next(expected);
      const result = await emission;

      expect(result.state).toEqual({ foo: "i" });
      expect(result.constraints).toEqual(expected.constraints);
    });

    it("emits dynamic constraints", async () => {
      const constraints$ = new BehaviorSubject(DynamicFooMaxLength);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject.withConstraints$);
      const expected: TestType = { foo: "next" };
      const emission = tracker.expectEmission();

      subject.next(expected);
      const actual = await emission;

      expect(actual.state).toEqual({ foo: "" });
      expect(actual.constraints).toEqual(DynamicFooMaxLength.expected.constraints);
    });

    it("emits constraints$ on next", async () => {
      const expected = fooMaxLength(2);
      const constraints$ = new BehaviorSubject(expected);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject.withConstraints$);
      const emission = tracker.expectEmission();

      subject.next({ foo: "next" });
      const result = await emission;

      expect(result.state).toEqual({ foo: "ne" });
      expect(result.constraints).toEqual(expected.constraints);
    });

    it("emits the latest constraints$ on next", async () => {
      const constraints$ = new BehaviorSubject(fooMaxLength(2));
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject.withConstraints$);
      const expected = fooMaxLength(3);
      constraints$.next(expected);

      const emission = tracker.expectEmission();
      subject.next({ foo: "next" });
      const result = await emission;

      expect(result.state).toEqual({ foo: "nex" });
      expect(result.constraints).toEqual(expected.constraints);
    });

    it("waits for constraints$", async () => {
      const constraints$ = new Subject<StateConstraints<TestType>>();
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject.withConstraints$);
      const expected = fooMaxLength(3);

      subject.next({ foo: "next" });
      constraints$.next(expected);
      // `init` is also waiting and is processed before `next`
      const [, nextResult] = await tracker.pauseUntilReceived(2);

      expect(nextResult.state).toEqual({ foo: "nex" });
      expect(nextResult.constraints).toEqual(expected.constraints);
    });

    it("emits the last-emitted value from constraints$ when constraints$ errors", async () => {
      const expected = fooMaxLength(3);
      const constraints$ = new BehaviorSubject(expected);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject.withConstraints$);

      constraints$.error({ some: "error" });
      subject.next({ foo: "next" });
      const [, nextResult] = await tracker.pauseUntilReceived(1);

      expect(nextResult.state).toEqual({ foo: "nex" });
      expect(nextResult.constraints).toEqual(expected.constraints);
    });

    it("emits the last-emitted value from constraints$ when constraints$ completes", async () => {
      const expected = fooMaxLength(3);
      const constraints$ = new BehaviorSubject(expected);
      const subject = new UserStateSubject(SomeKey, SomeProvider, {
        account$: SomeAccount$,
        constraints$,
      });
      const tracker = new ObservableTracker(subject.withConstraints$);

      constraints$.complete();
      subject.next({ foo: "next" });
      const [, nextResult] = await tracker.pauseUntilReceived(1);

      expect(nextResult.state).toEqual({ foo: "nex" });
      expect(nextResult.constraints).toEqual(expected.constraints);
    });
  });
});
