import {
  Observer,
  SubjectLike,
  Unsubscribable,
  ReplaySubject,
  filter,
  map,
  takeUntil,
  pairwise,
  distinctUntilChanged,
  BehaviorSubject,
  startWith,
  Observable,
  Subscription,
  last,
  concat,
  combineLatestWith,
  catchError,
  EMPTY,
  concatMap,
  OperatorFunction,
  pipe,
  first,
  withLatestFrom,
  scan,
  skip,
} from "rxjs";

import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SingleUserState, UserKeyDefinition } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { UserBound } from "../dependencies";
import { anyComplete, ready, withLatestReady } from "../rx";
import { Constraints, SubjectConstraints, WithConstraints } from "../types";

import { ClassifiedFormat, isClassifiedFormat } from "./classified-format";
import { unconstrained$ } from "./identity-state-constraint";
import { isObjectKey, ObjectKey, toUserKeyDefinition } from "./object-key";
import { isDynamic } from "./state-constraints-dependency";
import { UserEncryptor } from "./user-encryptor.abstraction";
import { UserStateSubjectDependencies } from "./user-state-subject-dependencies";

type Constrained<State> = { constraints: Readonly<Constraints<State>>; state: State };

/**
 * Adapt a state provider to an rxjs subject.
 *
 * This subject buffers the last value it received in memory. The buffer is erased
 * if the subject receives a complete or error event. It does not persist the buffer.
 *
 * Warning! The user state subject has a synchronous interface, but subscriptions are
 * always asynchronous.
 *
 * @template State the state stored by the subject
 * @template Dependencies use-specific dependencies provided by the user.
 */
export class UserStateSubject<
    State extends object,
    Secret = State,
    Disclosed = never,
    Dependencies = null,
  >
  extends Observable<State>
  implements SubjectLike<State>
{
  /**
   * Instantiates the user state subject
   * @param getState the backing store of the subject
   * @param context tailor the subject's behavior for a particular
   *   purpose.
   * @param dependencies.when$ blocks updates to the state subject until
   *   this becomes true. When this occurs, only the last-received update
   *   is applied. The blocked update is kept in memory. It does not persist
   *   to disk.
   * @param dependencies.singleUserId$ writes block until the singleUserId$
   *   is available.
   */
  constructor(
    private key: UserKeyDefinition<State> | ObjectKey<State, Secret, Disclosed>,
    getState: (key: UserKeyDefinition<unknown>) => SingleUserState<unknown>,
    private context: UserStateSubjectDependencies<State, Dependencies>,
  ) {
    super();

    if (isObjectKey(this.key)) {
      // classification and encryption only supported with `ObjectKey`
      this.objectKey = this.key;
      this.stateKey = toUserKeyDefinition(this.key);
      this.state = getState(this.stateKey);
    } else {
      // raw state access granted with `UserKeyDefinition`
      this.objectKey = null;
      this.stateKey = this.key as UserKeyDefinition<State>;
      this.state = getState(this.stateKey);
    }

    // normalize dependencies
    const when$ = (this.context.when$ ?? new BehaviorSubject(true)).pipe(distinctUntilChanged());

    // manage dependencies through replay subjects since `UserStateSubject`
    // reads them in multiple places
    const encryptor$ = new ReplaySubject<UserEncryptor>(1);
    const { singleUserId$, singleUserEncryptor$ } = this.context;
    this.encryptor(singleUserEncryptor$ ?? singleUserId$).subscribe(encryptor$);

    const constraints$ = new ReplaySubject<SubjectConstraints<State>>(1);
    (this.context.constraints$ ?? unconstrained$<State>())
      .pipe(
        // FIXME: this should probably log that an error occurred
        catchError(() => EMPTY),
      )
      .subscribe(constraints$);

    const dependencies$ = new ReplaySubject<Dependencies>(1);
    if (this.context.dependencies$) {
      this.context.dependencies$.subscribe(dependencies$);
    } else {
      dependencies$.next(null);
    }

    // wire output before input so that output normalizes the current state
    // before any `next` value is processed
    this.outputSubscription = this.state.state$
      .pipe(this.declassify(encryptor$), this.adjust(combineLatestWith(constraints$)))
      .subscribe(this.output);

    const last$ = new ReplaySubject<State>(1);
    this.output
      .pipe(
        last(),
        map((o) => o.state),
      )
      .subscribe(last$);

    // the update stream simulates the stateProvider's "shouldUpdate"
    // functionality & applies policy
    const updates$ = concat(
      this.input.pipe(
        this.when(when$),
        this.adjust(withLatestReady(constraints$)),
        this.prepareUpdate(this, dependencies$),
      ),
      // when the output subscription completes, its last-emitted value
      // loops around to the input for finalization
      last$.pipe(this.fix(constraints$), this.prepareUpdate(last$, dependencies$)),
    );

    // classification/encryption bound to the input subscription's lifetime
    // to ensure that `fix` has access to the encryptor key
    //
    // FIXME: this should probably timeout when a lock occurs
    this.inputSubscription = updates$
      .pipe(this.classify(encryptor$), takeUntil(anyComplete([when$, this.input, encryptor$])))
      .subscribe({
        next: (state) => this.onNext(state),
        error: (e: unknown) => this.onError(e),
        complete: () => this.onComplete(),
      });
  }

  private stateKey: UserKeyDefinition<unknown>;
  private objectKey: ObjectKey<State, Secret, Disclosed>;

  private encryptor(
    singleUserEncryptor$: Observable<UserBound<"encryptor", UserEncryptor> | UserId>,
  ): Observable<UserEncryptor> {
    return singleUserEncryptor$.pipe(
      // normalize inputs
      map((maybe): UserBound<"encryptor", UserEncryptor> => {
        if (typeof maybe === "object" && "encryptor" in maybe) {
          return maybe;
        } else if (typeof maybe === "string") {
          return { encryptor: null, userId: maybe as UserId };
        } else {
          throw new Error(`Invalid encryptor input received for ${this.key.key}.`);
        }
      }),
      // fail the stream if the state desyncs from the bound userId
      startWith({ userId: this.state.userId, encryptor: null } as UserBound<
        "encryptor",
        UserEncryptor
      >),
      pairwise(),
      map(([expected, actual]) => {
        if (expected.userId === actual.userId) {
          return actual;
        } else {
          throw {
            expectedUserId: expected.userId,
            actualUserId: actual.userId,
          };
        }
      }),
      // reduce emissions to when encryptor changes
      distinctUntilChanged(),
      map(({ encryptor }) => encryptor),
    );
  }

  private when(when$: Observable<boolean>): OperatorFunction<State, State> {
    return pipe(
      combineLatestWith(when$.pipe(distinctUntilChanged())),
      filter(([_, when]) => !!when),
      map(([input]) => input),
    );
  }

  private prepareUpdate(
    init$: Observable<State>,
    dependencies$: Observable<Dependencies>,
  ): OperatorFunction<Constrained<State>, State> {
    return (input$) =>
      concat(
        // `init$` becomes the accumulator for `scan`
        init$.pipe(
          first(),
          map((init) => [init, null] as const),
        ),
        input$.pipe(
          map((constrained) => constrained.state),
          withLatestFrom(dependencies$),
        ),
      ).pipe(
        // scan only emits values that can cause updates
        scan(([prev], [pending, dependencies]) => {
          const shouldUpdate = this.context.shouldUpdate?.(prev, pending, dependencies) ?? true;
          if (shouldUpdate) {
            // actual update
            const next = this.context.nextValue?.(prev, pending, dependencies) ?? pending;
            return [next, dependencies];
          } else {
            // false update
            return [prev, null];
          }
        }),
        // the first emission primes `scan`s aggregator
        skip(1),
        map(([state]) => state),

        // clean up false updates
        distinctUntilChanged(),
      );
  }

  private adjust(
    withConstraints: OperatorFunction<State, [State, SubjectConstraints<State>]>,
  ): OperatorFunction<State, Constrained<State>> {
    return pipe(
      // how constraints are blended with incoming emissions varies:
      // * `output` needs to emit when constraints update
      // * `input` needs to wait until a message flows through the pipe
      withConstraints,
      map(([loadedState, constraints]) => {
        const calibration = isDynamic(constraints)
          ? constraints.calibrate(loadedState)
          : constraints;
        const adjusted = calibration.adjust(loadedState);

        return {
          constraints: calibration.constraints,
          state: adjusted,
        };
      }),
    );
  }

  private fix(
    constraints$: Observable<SubjectConstraints<State>>,
  ): OperatorFunction<State, Constrained<State>> {
    return pipe(
      combineLatestWith(constraints$),
      map(([loadedState, constraints]) => {
        const calibration = isDynamic(constraints)
          ? constraints.calibrate(loadedState)
          : constraints;
        const fixed = calibration.fix(loadedState);

        return {
          constraints: calibration.constraints,
          state: fixed,
        };
      }),
    );
  }

  private declassify(encryptor$: Observable<UserEncryptor>): OperatorFunction<unknown, State> {
    // short-circuit if they key lacks encryption support
    if (!this.objectKey || this.objectKey.format === "plain") {
      return (input$) => input$ as Observable<State>;
    }

    // if the key supports encryption, enable encryptor support
    if (this.objectKey && this.objectKey.format === "classified") {
      return pipe(
        combineLatestWith(encryptor$),
        concatMap(async ([input, encryptor]) => {
          // pass through null values
          if (input === null || input === undefined) {
            return null;
          }

          // fail fast if the format is incorrect
          if (!isClassifiedFormat(input)) {
            throw new Error(`Cannot declassify ${this.key.key}; unknown format.`);
          }

          // decrypt classified data
          const { secret, disclosed } = input;
          const encrypted = EncString.fromJSON(secret);
          const decryptedSecret = await encryptor.decrypt<Secret>(encrypted);

          // assemble into proper state
          const declassified = this.objectKey.classifier.declassify(disclosed, decryptedSecret);
          const state = this.objectKey.options.deserializer(declassified);

          return state;
        }),
      );
    }

    throw new Error(`unknown serialization format: ${this.objectKey.format}`);
  }

  private classify(encryptor$: Observable<UserEncryptor>): OperatorFunction<State, unknown> {
    // short-circuit if they key lacks encryption support; `encryptor` is
    // readied to preserve `dependencies.singleUserId$` emission contract
    if (!this.objectKey || this.objectKey.format === "plain") {
      return pipe(
        ready(encryptor$),
        map((input) => input as unknown),
      );
    }

    // if the key supports encryption, enable encryptor support
    if (this.objectKey && this.objectKey.format === "classified") {
      return pipe(
        withLatestReady(encryptor$),
        concatMap(async ([input, encryptor]) => {
          // fail fast if there's no value
          if (input === null || input === undefined) {
            return null;
          }

          // split data by classification level
          const serialized = JSON.parse(JSON.stringify(input));
          const classified = this.objectKey.classifier.classify(serialized);

          // protect data
          const encrypted = await encryptor.encrypt(classified.secret);
          const secret = JSON.parse(JSON.stringify(encrypted));

          // wrap result in classified format envelope for storage
          const envelope = {
            id: null as void,
            secret,
            disclosed: classified.disclosed,
          } satisfies ClassifiedFormat<void, Disclosed>;

          // deliberate type erasure; the type is restored during `declassify`
          return envelope as unknown;
        }),
      );
    }

    // FIXME: add "encrypted" format --> key contains encryption logic
    // CONSIDER: should "classified format" algorithm be embedded in subject keys...?

    throw new Error(`unknown serialization format: ${this.objectKey.format}`);
  }

  /** The userId to which the subject is bound.
   */
  get userId() {
    return this.state.userId;
  }

  next(value: State) {
    this.input?.next(value);
  }

  error(err: any) {
    this.input?.error(err);
  }

  complete() {
    this.input?.complete();
  }

  /** Subscribe to the subject's event stream
   * @param observer listening for events
   * @returns the subscription
   */
  subscribe(observer?: Partial<Observer<State>> | ((value: State) => void) | null): Subscription {
    return this.output.pipe(map((wc) => wc.state)).subscribe(observer);
  }

  // using subjects to ensure the right semantics are followed;
  // if greater efficiency becomes desirable, consider implementing
  // `SubjectLike` directly
  private input = new ReplaySubject<State>(1);
  private state: SingleUserState<unknown>;
  private readonly output = new ReplaySubject<WithConstraints<State>>(1);

  /** A stream containing settings and their last-applied constraints. */
  get withConstraints$() {
    return this.output.asObservable();
  }

  private inputSubscription: Unsubscribable;
  private outputSubscription: Unsubscribable;

  private onNext(value: unknown) {
    this.state.update(() => value).catch((e: any) => this.onError(e));
  }

  private onError(value: any) {
    if (!this.isDisposed) {
      this.output.error(value);
    }

    this.dispose();
  }

  private onComplete() {
    if (!this.isDisposed) {
      this.output.complete();
    }

    this.dispose();
  }

  private get isDisposed() {
    return this.input === null;
  }

  private dispose() {
    if (!this.isDisposed) {
      // clean up internal subscriptions
      this.inputSubscription?.unsubscribe();
      this.outputSubscription?.unsubscribe();
      this.inputSubscription = null;
      this.outputSubscription = null;

      // drop input to ensure its value is removed from memory
      this.input = null;
    }
  }
}
