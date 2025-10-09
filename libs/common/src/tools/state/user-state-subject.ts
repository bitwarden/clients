// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Observer,
  SubjectLike,
  Unsubscribable,
  ReplaySubject,
  filter,
  map,
  takeUntil,
  distinctUntilChanged,
  BehaviorSubject,
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
  shareReplay,
  tap,
  switchMap,
} from "rxjs";

import { SemanticLogger } from "@bitwarden/logging";

import { Account } from "../../auth/abstractions/account.service";
import { EncString } from "../../key-management/crypto/models/enc-string";
import { SingleUserState, UserKeyDefinition } from "../../platform/state";
import { UserEncryptor } from "../cryptography/user-encryptor.abstraction";
import { anyComplete, pin, ready, withLatestReady } from "../rx";
import { Constraints, SubjectConstraints, WithConstraints } from "../types";

import { ClassifiedFormat, isClassifiedFormat } from "./classified-format";
import { unconstrained$ } from "./identity-state-constraint";
import { isObjectKey, ObjectKey, toUserKeyDefinition } from "./object-key";
import { isDynamic } from "./state-constraints-dependency";
import { UserStateSubjectDependencies } from "./user-state-subject-dependencies";
import { UserStateSubjectDependencyProvider } from "./user-state-subject-dependency-provider";

type Constrained<State> = { constraints: Readonly<Constraints<State>>; state: State };

// FIXME: The subject should always repeat the value when it's own `next` method is called.
//
// Chrome StateService only calls `next` when the underlying values changes. When enforcing,
// say, a minimum constraint, any value beneath the minimum becomes the minimum. This prevents
// invalid data received in sequence from calling `next` because the state provider doesn't
// emit.
//
// The hack is pretty simple. Insert arbitrary data into the saved data to ensure
// that it *always* changes.
//
// Any real fix will be fairly complex because it needs to recognize *fast* when it
// is waiting. Alternatively, the kludge could become a format properly fed by random noise.
//
// NOTE: this only matters for plaintext objects; encrypted fields change with every
//   update b/c their IVs change.
const ALWAYS_UPDATE_KLUDGE = "$^$ALWAYS_UPDATE_KLUDGE_PROPERTY$^$";

/** Default frame size for data packing */
const DEFAULT_FRAME_SIZE = 32;

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
    Disclosed = Record<string, never>,
    Dependencies = null,
  >
  extends Observable<State>
  implements SubjectLike<State>
{
  /**
   * Instantiates the user state subject bound to a persistent backing store
   * @param key identifies the persistent backing store
   * @param getState creates a persistent backing store using a key
   * @param context tailor the subject's behavior for a particular
   *   purpose.
   * @param dependencies.when$ blocks updates to the state subject until
   *   this becomes true. When this occurs, only the last-received update
   *   is applied. The blocked update is kept in memory. It does not persist
   *   to disk.
   * @param dependencies.account$ writes block until the account$
   *   is available.
   */
  constructor(
    private key: UserKeyDefinition<State> | ObjectKey<State, Secret, Disclosed>,
    private providers: UserStateSubjectDependencyProvider,
    private context: UserStateSubjectDependencies<State, Dependencies>,
  ) {
    super();

    if (isObjectKey(this.key)) {
      // classification and encryption only supported with `ObjectKey`
      this.objectKey = this.key;
      this.stateKey = toUserKeyDefinition(this.key);
    } else {
      // raw state access granted with `UserKeyDefinition`
      this.objectKey = null;
      this.stateKey = this.key as UserKeyDefinition<State>;
    }

    this.log = this.providers.log({
      contextId: this.contextId,
      type: "UserStateSubject",
      storage: {
        state: this.stateKey.stateDefinition.name,
        key: this.stateKey.key,
      },
    });

    // normalize dependencies
    const when$ = (this.context.when$ ?? new BehaviorSubject(true)).pipe(distinctUntilChanged());
    const account$ = context.account$.pipe(
      pin({
        name: () => `${this.contextId} { account$ }`,
        distinct(prev, current) {
          return prev.id === current.id;
        },
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
    const encryptor$ = this.encryptor(account$);
    const constraints$ = (this.context.constraints$ ?? unconstrained$<State>()).pipe(
      catchError((e: unknown) => {
        this.log.error(e as object, "constraints$ dependency failed; using last-known constraints");
        return EMPTY;
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
    const dependencies$ = (
      this.context.dependencies$ ?? new BehaviorSubject<Dependencies>(null)
    ).pipe(shareReplay({ refCount: true, bufferSize: 1 }));

    // load state once the account becomes available
    const userState$ = account$.pipe(
      tap((account) => this.log.debug({ accountId: account.id }, "loading user state")),
      map((account) => this.providers.state.getUser(account.id, this.stateKey)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    // wire output before input so that output normalizes the current state
    // before any `next` value is processed
    this.outputSubscription = userState$
      .pipe(
        switchMap((userState) => userState.state$),
        map((stored) => {
          if (stored && typeof stored === "object" && ALWAYS_UPDATE_KLUDGE in stored) {
            // related: ALWAYS_UPDATE_KLUDGE FIXME
            delete stored[ALWAYS_UPDATE_KLUDGE];
          }

          return stored;
        }),
        this.declassify(encryptor$),
        this.adjust(combineLatestWith(constraints$)),
        takeUntil(anyComplete(account$)),
      )
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
      .pipe(
        this.classify(encryptor$),
        withLatestFrom(userState$),
        takeUntil(anyComplete([when$, this.input, encryptor$])),
      )
      .subscribe({
        next: ([input, state]) => this.onNext(input, state),
        error: (e: unknown) => this.onError(e),
        complete: () => this.onComplete(),
      });
  }

  private get contextId() {
    return `UserStateSubject(${this.stateKey.stateDefinition.name}, ${this.stateKey.key})`;
  }

  private readonly log: SemanticLogger;

  private readonly stateKey: UserKeyDefinition<unknown>;
  private readonly objectKey: ObjectKey<State, Secret, Disclosed>;

  private encryptor(account$: Observable<Account>): Observable<UserEncryptor> {
    const singleUserId$ = account$.pipe(map((account) => account.id));
    const frameSize = this.objectKey?.frame ?? DEFAULT_FRAME_SIZE;
    const encryptor$ = this.providers.encryptor.userEncryptor$(frameSize, { singleUserId$ }).pipe(
      tap(() => this.log.debug("encryptor constructed")),
      map(({ encryptor }) => encryptor),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
    return encryptor$;
  }

  private when(when$: Observable<boolean>): OperatorFunction<State, State> {
    return pipe(
      combineLatestWith(when$.pipe(distinctUntilChanged())),
      tap(([_, when]) => this.log.debug({ when }, "when status")),
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
          map((init) => [init, null] as [State, Dependencies]),
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
            return [next, dependencies] as const;
          } else {
            // false update
            this.log.debug("shouldUpdate prevented write");
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
        if (!loadedState && !this.objectKey?.initial) {
          this.log.debug("no value; bypassing adjustment");
          return {
            constraints: {} as Constraints<State>,
            state: null,
          } satisfies Constrained<State>;
        }

        this.log.debug("adjusting");
        const unconstrained = loadedState ?? structuredClone(this.objectKey.initial);
        const calibration = isDynamic(constraints)
          ? constraints.calibrate(unconstrained)
          : constraints;
        const adjusted = calibration.adjust(unconstrained);

        this.log.debug("adjusted");
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
        this.log.debug("fixing");

        const calibration = isDynamic(constraints)
          ? constraints.calibrate(loadedState)
          : constraints;
        const fixed = calibration.fix(loadedState);

        this.log.debug("fixed");
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
      this.log.debug("key uses plain format; bypassing declassification");
      return (input$) => input$ as Observable<State>;
    }

    // all other keys support encryption; enable encryptor support
    return pipe(
      this.mapToClassifiedFormat(),
      combineLatestWith(encryptor$),
      concatMap(async ([input, encryptor]) => {
        // pass through null values
        if (input === null || input === undefined) {
          this.log.debug("no value; bypassing declassification");
          return null;
        }

        this.log.debug("declassifying");

        // decrypt classified data
        const { secret, disclosed } = input;
        const encrypted = EncString.fromJSON(secret);
        const decryptedSecret = await encryptor.decrypt<Secret>(encrypted);

        // assemble into proper state
        const declassified = this.objectKey.classifier.declassify(disclosed, decryptedSecret);
        const state = this.objectKey.options.deserializer(declassified);

        this.log.debug("declassified");
        return state;
      }),
    );
  }

  private mapToClassifiedFormat(): OperatorFunction<unknown, ClassifiedFormat<unknown, unknown>> {
    // FIXME: warn when data is dropped in the console and/or report an error
    //   through the observable; consider redirecting dropped data to a recovery
    //   location

    // user-state subject's default format is object-aware
    if (this.objectKey && this.objectKey.format === "classified") {
      return map((input) => {
        if (!isClassifiedFormat(input)) {
          this.log.warn("classified data must be in classified format; dropping");
          return null;
        }

        return input;
      });
    }

    // secret state's format wraps objects in an array
    if (this.objectKey && this.objectKey.format === "secret-state") {
      return map((input) => {
        if (!Array.isArray(input)) {
          this.log.warn("secret-state requires array formatting; dropping");
          return null;
        }

        const [unwrapped] = input;
        if (!isClassifiedFormat(unwrapped)) {
          this.log.warn("unwrapped secret-state must be in classified format; dropping");
          return null;
        }

        return unwrapped;
      });
    }

    this.log.panic({ format: this.objectKey.format }, "unsupported serialization format");
  }

  private classify(encryptor$: Observable<UserEncryptor>): OperatorFunction<State, unknown> {
    // short-circuit if they key lacks encryption support; `encryptor` is
    // readied to preserve `dependencies.singleUserId$` emission contract
    if (!this.objectKey || this.objectKey.format === "plain") {
      this.log.debug("key uses plain format; bypassing classification");
      return pipe(
        ready(encryptor$),
        map((input) => input as unknown),
      );
    }

    // all other keys support encryption; enable encryptor support
    return pipe(
      withLatestReady(encryptor$),
      concatMap(async ([input, encryptor]) => {
        // fail fast if there's no value
        if (input === null || input === undefined) {
          this.log.debug("no value; bypassing classification");
          return null;
        }

        this.log.debug("classifying");

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

        this.log.debug("classified");
        // deliberate type erasure; the type is restored during `declassify`
        return envelope as ClassifiedFormat<unknown, unknown>;
      }),
      this.mapToStorageFormat(),
    );
  }

  private mapToStorageFormat(): OperatorFunction<ClassifiedFormat<unknown, unknown>, unknown> {
    // user-state subject's default format is object-aware
    if (this.objectKey && this.objectKey.format === "classified") {
      return map((input) => input as unknown);
    }

    // secret state's format wraps objects in an array
    if (this.objectKey && this.objectKey.format === "secret-state") {
      return map((input) => [input] as unknown);
    }

    this.log.panic({ format: this.objectKey.format }, "unsupported serialization format");
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
    return this.output
      .pipe(
        map((wc) => wc.state),
        distinctUntilChanged(),
      )
      .subscribe(observer);
  }

  // using subjects to ensure the right semantics are followed;
  // if greater efficiency becomes desirable, consider implementing
  // `SubjectLike` directly
  private input = new ReplaySubject<State>(1);
  private readonly output = new ReplaySubject<WithConstraints<State>>(1);

  /** A stream containing settings and their last-applied constraints. */
  get withConstraints$() {
    return this.output.asObservable();
  }

  private inputSubscription: Unsubscribable;
  private outputSubscription: Unsubscribable;

  private counter = 0;

  private onNext(value: unknown, state: SingleUserState<unknown>) {
    state
      .update(() => {
        this.log.debug("updating");

        if (typeof value === "object") {
          // related: ALWAYS_UPDATE_KLUDGE FIXME
          const counter = this.counter++;
          if (counter > Number.MAX_SAFE_INTEGER) {
            this.counter = 0;
          }

          const kludge = { ...value } as any;
          kludge[ALWAYS_UPDATE_KLUDGE] = counter;
        }

        this.log.debug("updated");
        return value;
      })
      .catch((e: any) => {
        this.log.error(e as object, "updating failed");
        this.onError(e);
      });
  }

  private onError(value: any) {
    if (!this.isDisposed) {
      this.log.debug(value, "forwarding error to subscribers");
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
      this.log.debug("disposing");

      // clean up internal subscriptions
      this.inputSubscription?.unsubscribe();
      this.outputSubscription?.unsubscribe();
      this.inputSubscription = null;
      this.outputSubscription = null;

      // drop input to ensure its value is removed from memory
      this.input = null;

      this.log.debug("disposed");
    }
  }
}
