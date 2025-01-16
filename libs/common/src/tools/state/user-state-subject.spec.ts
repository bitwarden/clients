import { BehaviorSubject, of, Subject } from "rxjs";

import { awaitAsync, FakeSingleUserState, ObservableTracker } from "../../../spec";
import { GENERATOR_DISK, UserKeyDefinition } from "../../platform/state";
import { UserId } from "../../types/guid";
import { UserEncryptor } from "../cryptography/user-encryptor.abstraction";
import { UserBound } from "../dependencies";
import { PrivateClassifier } from "../private-classifier";
import { StateConstraints } from "../types";

import { ClassifiedFormat } from "./classified-format";
import { ObjectKey } from "./object-key";
import { UserStateSubject } from "./user-state-subject";

const SomeUser = "some user" as UserId;
type TestType = { foo: string };
const SomeKey = new UserKeyDefinition<TestType>(GENERATOR_DISK, "TestKey", {
  deserializer: (d) => d as TestType,
  clearOn: [],
});

const SomeObjectKey = {
  target: "object",
  key: "TestObjectKey",
  state: GENERATOR_DISK,
  classifier: new PrivateClassifier(),
  format: "classified",
  options: {
    deserializer: (d) => d as TestType,
    clearOn: ["logout"],
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

describe("UserStateSubject", () => {
  describe("dependencies", () => {
    it("ignores repeated when$ emissions", async () => {
      // this test looks for `nextValue` because a subscription isn't necessary for
      // the subject to update
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const nextValue = jest.fn((_, next) => next);
      const when$ = new BehaviorSubject(true);
      const subject = new UserStateSubject(SomeKey, () => state, {
        singleUserId$,
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

    it("ignores repeated singleUserId$ emissions", async () => {
      // this test looks for `nextValue` because a subscription isn't necessary for
      // the subject to update
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const nextValue = jest.fn((_, next) => next);
      const when$ = new BehaviorSubject(true);
      const subject = new UserStateSubject(SomeKey, () => state, {
        singleUserId$,
        nextValue,
        when$,
      });

      // the interleaved await asyncs are only necessary b/c `nextValue` is called asynchronously
      subject.next({ foo: "next" });
      await awaitAsync();
      singleUserId$.next(SomeUser);
      await awaitAsync();
      singleUserId$.next(SomeUser);
      singleUserId$.next(SomeUser);
      await awaitAsync();

      expect(nextValue).toHaveBeenCalledTimes(1);
    });

    it("ignores repeated singleUserEncryptor$ emissions", async () => {
      // this test looks for `nextValue` because a subscription isn't necessary for
      // the subject to update
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const nextValue = jest.fn((_, next) => next);
      const singleUserEncryptor$ = new BehaviorSubject({ userId: SomeUser, encryptor: null });
      const subject = new UserStateSubject(SomeKey, () => state, {
        nextValue,
        singleUserEncryptor$,
      });

      // the interleaved await asyncs are only necessary b/c `nextValue` is called asynchronously
      subject.next({ foo: "next" });
      await awaitAsync();
      singleUserEncryptor$.next({ userId: SomeUser, encryptor: null });
      await awaitAsync();
      singleUserEncryptor$.next({ userId: SomeUser, encryptor: null });
      singleUserEncryptor$.next({ userId: SomeUser, encryptor: null });
      await awaitAsync();

      expect(nextValue).toHaveBeenCalledTimes(1);
    });

    it("waits for constraints$", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const constraints$ = new Subject<StateConstraints<TestType>>();
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
      const tracker = new ObservableTracker(subject);

      constraints$.next(fooMaxLength(3));
      const [initResult] = await tracker.pauseUntilReceived(1);

      expect(initResult).toEqual({ foo: "ini" });
    });

    it("waits for singleUserEncryptor$", async () => {
      const state = new FakeSingleUserState<ClassifiedFormat<void, Record<string, never>>>(
        SomeUser,
        { id: null, secret: '{"foo":"init"}', disclosed: {} },
      );
      const singleUserEncryptor$ = new Subject<UserBound<"encryptor", UserEncryptor>>();
      const subject = new UserStateSubject(SomeObjectKey, () => state, { singleUserEncryptor$ });
      const tracker = new ObservableTracker(subject);

      singleUserEncryptor$.next({ userId: SomeUser, encryptor: SomeEncryptor });
      const [initResult] = await tracker.pauseUntilReceived(1);

      expect(initResult).toEqual({ foo: "decrypt(init)" });
    });
  });

  describe("next", () => {
    it("emits the next value", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });
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
      const initialState = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialState);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });

      let actual: TestType = null;
      subject.subscribe((value) => {
        actual = value;
      });
      subject.complete();
      subject.next({ foo: "ignored" });
      await awaitAsync();

      expect(actual).toEqual(initialState);
    });

    it("evaluates shouldUpdate", async () => {
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const shouldUpdate = jest.fn(() => true);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, shouldUpdate });

      const nextVal: TestType = { foo: "next" };
      subject.next(nextVal);
      await awaitAsync();

      expect(shouldUpdate).toHaveBeenCalledWith(initialValue, nextVal, null);
    });

    it("evaluates shouldUpdate with a dependency", async () => {
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const shouldUpdate = jest.fn(() => true);
      const dependencyValue = { bar: "dependency" };
      const subject = new UserStateSubject(SomeKey, () => state, {
        singleUserId$,
        shouldUpdate,
        dependencies$: of(dependencyValue),
      });

      const nextVal: TestType = { foo: "next" };
      subject.next(nextVal);
      await awaitAsync();

      expect(shouldUpdate).toHaveBeenCalledWith(initialValue, nextVal, dependencyValue);
    });

    it("emits a value when shouldUpdate returns `true`", async () => {
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const shouldUpdate = jest.fn(() => true);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, shouldUpdate });
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
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const shouldUpdate = jest.fn(() => false);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, shouldUpdate });

      subject.next({ foo: "next" });
      await awaitAsync();
      let actual: TestType = null;
      subject.subscribe((value) => {
        actual = value;
      });

      expect(actual).toEqual(initialValue);
    });

    it("evaluates nextValue", async () => {
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const nextValue = jest.fn((_, next) => next);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, nextValue });

      const nextVal: TestType = { foo: "next" };
      subject.next(nextVal);
      await awaitAsync();

      expect(nextValue).toHaveBeenCalledWith(initialValue, nextVal, null);
    });

    it("evaluates nextValue with a dependency", async () => {
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const nextValue = jest.fn((_, next) => next);
      const dependencyValue = { bar: "dependency" };
      const subject = new UserStateSubject(SomeKey, () => state, {
        singleUserId$,
        nextValue,
        dependencies$: of(dependencyValue),
      });

      const nextVal: TestType = { foo: "next" };
      subject.next(nextVal);
      await awaitAsync();

      expect(nextValue).toHaveBeenCalledWith(initialValue, nextVal, dependencyValue);
    });

    it("evaluates nextValue when when$ is true", async () => {
      // this test looks for `nextValue` because a subscription isn't necessary for
      // the subject to update
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const nextValue = jest.fn((_, next) => next);
      const when$ = new BehaviorSubject(true);
      const subject = new UserStateSubject(SomeKey, () => state, {
        singleUserId$,
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
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const nextValue = jest.fn((_, next) => next);
      const when$ = new BehaviorSubject(false);
      const subject = new UserStateSubject(SomeKey, () => state, {
        singleUserId$,
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

    it("waits to evaluate `UserState.update` until singleUserId$ emits", async () => {
      // this test looks for `nextMock` because a subscription isn't necessary for
      // the subject to update.
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new Subject<UserId>();
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });

      // precondition: subject doesn't update after `next`
      const nextVal: TestType = { foo: "next" };
      subject.next(nextVal);
      await awaitAsync();
      expect(state.nextMock).not.toHaveBeenCalled();

      singleUserId$.next(SomeUser);
      await awaitAsync();

      expect(state.nextMock).toHaveBeenCalledWith({
        foo: "next",
        // FIXME: don't leak this detail into the test
        "$^$ALWAYS_UPDATE_KLUDGE_PROPERTY$^$": 0,
      });
    });

    it("waits to evaluate `UserState.update` until singleUserEncryptor$ emits", async () => {
      const state = new FakeSingleUserState<ClassifiedFormat<void, Record<string, never>>>(
        SomeUser,
        { id: null, secret: '{"foo":"init"}', disclosed: null },
      );
      const singleUserEncryptor$ = new Subject<UserBound<"encryptor", UserEncryptor>>();
      const subject = new UserStateSubject(SomeObjectKey, () => state, { singleUserEncryptor$ });

      // precondition: subject doesn't update after `next`
      const nextVal: TestType = { foo: "next" };
      subject.next(nextVal);
      await awaitAsync();
      expect(state.nextMock).not.toHaveBeenCalled();

      singleUserEncryptor$.next({ userId: SomeUser, encryptor: SomeEncryptor });
      await awaitAsync();

      const encrypted = { foo: "encrypt(next)" };
      expect(state.nextMock).toHaveBeenCalledWith({
        id: null,
        secret: encrypted,
        disclosed: null,
        // FIXME: don't leak this detail into the test
        "$^$ALWAYS_UPDATE_KLUDGE_PROPERTY$^$": 0,
      });
    });

    it("applies dynamic constraints", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const constraints$ = new BehaviorSubject(DynamicFooMaxLength);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
      const tracker = new ObservableTracker(subject);
      const expected: TestType = { foo: "next" };
      const emission = tracker.expectEmission();

      subject.next(expected);
      const actual = await emission;

      expect(actual).toEqual({ foo: "" });
    });

    it("applies constraints$ on next", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const constraints$ = new BehaviorSubject(fooMaxLength(2));
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
      const tracker = new ObservableTracker(subject);

      subject.next({ foo: "next" });
      const [, result] = await tracker.pauseUntilReceived(2);

      expect(result).toEqual({ foo: "ne" });
    });

    it("applies latest constraints$ on next", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const constraints$ = new BehaviorSubject(fooMaxLength(2));
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
      const tracker = new ObservableTracker(subject);

      constraints$.next(fooMaxLength(3));
      subject.next({ foo: "next" });
      const [, , result] = await tracker.pauseUntilReceived(3);

      expect(result).toEqual({ foo: "nex" });
    });

    it("waits for constraints$", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const constraints$ = new Subject<StateConstraints<TestType>>();
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
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
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const constraints$ = new BehaviorSubject(fooMaxLength(3));
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
      const tracker = new ObservableTracker(subject);

      constraints$.error({ some: "error" });
      subject.next({ foo: "next" });
      const [, nextResult] = await tracker.pauseUntilReceived(1);

      expect(nextResult).toEqual({ foo: "nex" });
    });

    it("uses the last-emitted value from constraints$ when constraints$ completes", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const constraints$ = new BehaviorSubject(fooMaxLength(3));
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
      const tracker = new ObservableTracker(subject);

      constraints$.complete();
      subject.next({ foo: "next" });
      const [, nextResult] = await tracker.pauseUntilReceived(1);

      expect(nextResult).toEqual({ foo: "nex" });
    });
  });

  describe("error", () => {
    it("emits errors", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });
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
      const initialState = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialState);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });

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
      const initialState = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialState);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });

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
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });

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
      const initialState = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialState);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });

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
      const initialState = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialState);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });

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
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const constraints$ = new BehaviorSubject(fooMaxLength(2));
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
      const tracker = new ObservableTracker(subject);

      const [result] = await tracker.pauseUntilReceived(1);

      expect(result).toEqual({ foo: "in" });
    });

    it("applies constraints$ on constraints$ emission", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const constraints$ = new BehaviorSubject(fooMaxLength(2));
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
      const tracker = new ObservableTracker(subject);

      constraints$.next(fooMaxLength(1));
      const [, result] = await tracker.pauseUntilReceived(2);

      expect(result).toEqual({ foo: "i" });
    });

    it("completes when singleUserId$ completes", async () => {
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });

      let actual = false;
      subject.subscribe({
        complete: () => {
          actual = true;
        },
      });
      singleUserId$.complete();
      await awaitAsync();

      expect(actual).toBeTruthy();
    });

    it("completes when singleUserId$ completes", async () => {
      const state = new FakeSingleUserState<ClassifiedFormat<void, Record<string, never>>>(
        SomeUser,
        { id: null, secret: '{"foo":"init"}', disclosed: null },
      );
      const singleUserEncryptor$ = new Subject<UserBound<"encryptor", UserEncryptor>>();
      const subject = new UserStateSubject(SomeObjectKey, () => state, { singleUserEncryptor$ });

      let actual = false;
      subject.subscribe({
        complete: () => {
          actual = true;
        },
      });
      singleUserEncryptor$.complete();
      await awaitAsync();

      expect(actual).toBeTruthy();
    });

    it("completes when when$ completes", async () => {
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const when$ = new BehaviorSubject(true);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, when$ });

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

    it("errors when singleUserId$ changes", async () => {
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });
      const errorUserId = "error" as UserId;

      let error = false;
      subject.subscribe({
        error: (e: unknown) => {
          error = e as any;
        },
      });
      singleUserId$.next(errorUserId);
      await awaitAsync();

      expect(error).toEqual({ expectedUserId: SomeUser, actualUserId: errorUserId });
    });

    it("errors when singleUserEncryptor$ changes", async () => {
      const state = new FakeSingleUserState<ClassifiedFormat<void, Record<string, never>>>(
        SomeUser,
        { id: null, secret: '{"foo":"init"}', disclosed: null },
      );
      const singleUserEncryptor$ = new Subject<UserBound<"encryptor", UserEncryptor>>();
      const subject = new UserStateSubject(SomeObjectKey, () => state, { singleUserEncryptor$ });
      const errorUserId = "error" as UserId;

      let error = false;
      subject.subscribe({
        error: (e: unknown) => {
          error = e as any;
        },
      });
      singleUserEncryptor$.next({ userId: SomeUser, encryptor: SomeEncryptor });
      singleUserEncryptor$.next({ userId: errorUserId, encryptor: SomeEncryptor });
      await awaitAsync();

      expect(error).toEqual({ expectedUserId: SomeUser, actualUserId: errorUserId });
    });

    it("errors when singleUserId$ errors", async () => {
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });
      const expected = { error: "description" };

      let actual = false;
      subject.subscribe({
        error: (e: unknown) => {
          actual = e as any;
        },
      });
      singleUserId$.error(expected);
      await awaitAsync();

      expect(actual).toEqual(expected);
    });

    it("errors when singleUserEncryptor$ errors", async () => {
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserEncryptor$ = new Subject<UserBound<"encryptor", UserEncryptor>>();
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserEncryptor$ });
      const expected = { error: "description" };

      let actual = false;
      subject.subscribe({
        error: (e: unknown) => {
          actual = e as any;
        },
      });
      singleUserEncryptor$.error(expected);
      await awaitAsync();

      expect(actual).toEqual(expected);
    });

    it("errors when when$ errors", async () => {
      const initialValue: TestType = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialValue);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const when$ = new BehaviorSubject(true);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, when$ });
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

  describe("userId", () => {
    it("returns the userId to which the subject is bound", () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new Subject<UserId>();
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });

      expect(subject.userId).toEqual(SomeUser);
    });
  });

  describe("withConstraints$", () => {
    it("emits the next value with an empty constraint", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });
      const tracker = new ObservableTracker(subject.withConstraints$);
      const expected: TestType = { foo: "next" };
      const emission = tracker.expectEmission();

      subject.next(expected);
      const actual = await emission;

      expect(actual.state).toEqual(expected);
      expect(actual.constraints).toEqual({});
    });

    it("ceases emissions once the subject completes", async () => {
      const initialState = { foo: "init" };
      const state = new FakeSingleUserState<TestType>(SomeUser, initialState);
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$ });
      const tracker = new ObservableTracker(subject.withConstraints$);

      subject.complete();
      subject.next({ foo: "ignored" });
      const [result] = await tracker.pauseUntilReceived(1);

      expect(result.state).toEqual(initialState);
      expect(tracker.emissions.length).toEqual(1);
    });

    it("emits constraints$ on constraints$ emission", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const constraints$ = new BehaviorSubject(fooMaxLength(2));
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
      const tracker = new ObservableTracker(subject.withConstraints$);
      const expected = fooMaxLength(1);
      const emission = tracker.expectEmission();

      constraints$.next(expected);
      const result = await emission;

      expect(result.state).toEqual({ foo: "i" });
      expect(result.constraints).toEqual(expected.constraints);
    });

    it("emits dynamic constraints", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const constraints$ = new BehaviorSubject(DynamicFooMaxLength);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
      const tracker = new ObservableTracker(subject.withConstraints$);
      const expected: TestType = { foo: "next" };
      const emission = tracker.expectEmission();

      subject.next(expected);
      const actual = await emission;

      expect(actual.state).toEqual({ foo: "" });
      expect(actual.constraints).toEqual(DynamicFooMaxLength.expected.constraints);
    });

    it("emits constraints$ on next", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const expected = fooMaxLength(2);
      const constraints$ = new BehaviorSubject(expected);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
      const tracker = new ObservableTracker(subject.withConstraints$);
      const emission = tracker.expectEmission();

      subject.next({ foo: "next" });
      const result = await emission;

      expect(result.state).toEqual({ foo: "ne" });
      expect(result.constraints).toEqual(expected.constraints);
    });

    it("emits the latest constraints$ on next", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const constraints$ = new BehaviorSubject(fooMaxLength(2));
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
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
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const constraints$ = new Subject<StateConstraints<TestType>>();
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
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
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const expected = fooMaxLength(3);
      const constraints$ = new BehaviorSubject(expected);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
      const tracker = new ObservableTracker(subject.withConstraints$);

      constraints$.error({ some: "error" });
      subject.next({ foo: "next" });
      const [, nextResult] = await tracker.pauseUntilReceived(1);

      expect(nextResult.state).toEqual({ foo: "nex" });
      expect(nextResult.constraints).toEqual(expected.constraints);
    });

    it("emits the last-emitted value from constraints$ when constraints$ completes", async () => {
      const state = new FakeSingleUserState<TestType>(SomeUser, { foo: "init" });
      const singleUserId$ = new BehaviorSubject(SomeUser);
      const expected = fooMaxLength(3);
      const constraints$ = new BehaviorSubject(expected);
      const subject = new UserStateSubject(SomeKey, () => state, { singleUserId$, constraints$ });
      const tracker = new ObservableTracker(subject.withConstraints$);

      constraints$.complete();
      subject.next({ foo: "next" });
      const [, nextResult] = await tracker.pauseUntilReceived(1);

      expect(nextResult.state).toEqual({ foo: "nex" });
      expect(nextResult.constraints).toEqual(expected.constraints);
    });
  });
});
