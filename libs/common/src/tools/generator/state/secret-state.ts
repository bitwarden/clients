import { Observable, concatMap, of, zip, map } from "rxjs";
import { Jsonify } from "type-fest";

import { EncString } from "../../../platform/models/domain/enc-string";
import {
  DeriveDefinition,
  DerivedState,
  KeyDefinition,
  SingleUserState,
  StateProvider,
  StateUpdateOptions,
  CombinedState,
} from "../../../platform/state";
import { UserId } from "../../../types/guid";

import { SecretKeyDefinition } from "./secret-key-definition";
import { UserEncryptor } from "./user-encryptor.abstraction";

/** Describes the structure of data stored by the SecretState's
 *  encrypted state. Notably, this interface ensures that `Disclosed`
 *  round trips through JSON serialization. It also preserves the
 *  Id.
 *  @remarks Tuple representation chosen because it matches
 *  `Object.entries` format.
 */
type ClassifiedFormat<Id, Disclosed> = {
  /** Identifies records. `null` when storing a `value` */
  readonly id: Id | null;
  /** Serialized {@link EncString} of the secret state's
   *  secret-level classified data.
   */
  readonly secret: string;
  /** serialized representation of the secret state's
   * disclosed-level classified data.
   */
  readonly disclosed: Jsonify<Disclosed>;
};

/** Stores account-specific secrets protected by a UserKeyEncryptor.
 *
 *  @remarks This state store changes the structure of `Plaintext` during
 *  storage, and requires user keys to operate. It is incompatible with sync,
 *  which expects the disk storage format to be identical to the sync format.
 *
 *  DO NOT USE THIS for synchronized data.
 */
export class SecretState<Outer, Id, Plaintext extends object, Disclosed, Secret>
  implements SingleUserState<Outer>
{
  // The constructor is private to avoid creating a circular dependency when
  // wiring the derived and secret states together.
  private constructor(
    private readonly key: SecretKeyDefinition<Outer, Id, Plaintext, Disclosed, Secret>,
    private readonly encryptor: UserEncryptor<Secret>,
    private readonly encrypted: SingleUserState<ClassifiedFormat<Id, Disclosed>[]>,
    private readonly plaintext: DerivedState<Outer>,
  ) {
    this.state$ = plaintext.state$;
    this.combinedState$ = plaintext.state$.pipe(map((state) => [this.encrypted.userId, state]));
  }

  /** {@link SingleUserState.userId} */
  get userId() {
    return this.encrypted.userId;
  }

  /** Observes changes to the decrypted secret state. The observer
   *  updates after the secret has been recorded to state storage.
   *  @returns `undefined` when the account is locked.
   */
  readonly state$: Observable<Outer>;

  /** {@link SingleUserState.combinedState$} */
  readonly combinedState$: Observable<CombinedState<Outer>>;

  /** Creates a secret state bound to an account encryptor. The account must be unlocked
   *  when this method is called.
   *  @param userId: the user to which the secret state is bound.
   *  @param key Converts between a declassified secret and its formal type.
   *  @param provider constructs state objects.
   *  @param encryptor protects `Secret` data.
   *  @throws when `key.stateDefinition` is backed by memory storage.
   *  @remarks Secrets are written to a secret store as a named tuple. Data classification is
   *    determined by the encryptor's classifier. Secret-classification data is jsonified,
   *    encrypted, and stored in a `secret` property. Disclosed-classification data is stored
   *    in a `disclosed` property. Omitted-classification data is not stored.
   */
  static from<Outer, Id, TFrom extends object, Disclosed, Secret>(
    userId: UserId,
    key: SecretKeyDefinition<Outer, Id, TFrom, Disclosed, Secret>,
    provider: StateProvider,
    encryptor: UserEncryptor<Secret>,
  ) {
    // construct encrypted backing store while avoiding collisions between the derived key and the
    // backing storage key.
    const secretKey = new KeyDefinition<ClassifiedFormat<Id, Disclosed>[]>(
      key.stateDefinition,
      key.key,
      {
        cleanupDelayMs: key.options.cleanupDelayMs,
        // FIXME: When the fakes run deserializers and serialization can be guaranteed through
        // state providers, decode `jsonValue.secret` instead of it running in `derive`.
        deserializer: (jsonValue) => jsonValue as ClassifiedFormat<Id, Disclosed>[],
      },
    );
    const encryptedState = provider.getUser(userId, secretKey);

    // construct plaintext store
    const plaintextDefinition = DeriveDefinition.from<ClassifiedFormat<Id, Disclosed>[], Outer>(
      secretKey,
      {
        derive: async (from) => {
          // fail fast if there's no value
          if (from === null || from === undefined) {
            return null;
          }

          // decrypt each item
          const decryptTasks = from.map(async ({ id, secret, disclosed }) => {
            const encrypted = EncString.fromJSON(secret);
            const decrypted = await encryptor.decrypt(encrypted, encryptedState.userId);

            const declassified = key.classifier.declassify(disclosed, decrypted);
            const result = key.options.deserializer(declassified);

            return [id, result] as const;
          });

          // reconstruct expected type
          const results = await Promise.all(decryptTasks);
          const result = key.reconstruct(results);

          return result;
        },
        // wire in the caller's deserializer for memory serialization
        deserializer: (d) => {
          const items = key.deconstruct(d);
          const results = items.map(([k, v]) => [k, key.options.deserializer(v)] as const);
          const result = key.reconstruct(results);
          return result;
        },
        // cache the decrypted data in memory
        cleanupDelayMs: key.options.cleanupDelayMs,
      },
    );
    const plaintextState = provider.getDerived(encryptedState.state$, plaintextDefinition, null);

    // wrap the encrypted and plaintext states in a `SecretState` facade
    const secretState = new SecretState(key, encryptor, encryptedState, plaintextState);
    return secretState;
  }

  /** Updates the secret stored by this state.
   *  @param configureState a callback that returns an updated decrypted
   *   secret state. The callback receives the state's present value as its
   *   first argument and the dependencies listed in `options.combinedLatestWith`
   *   as its second argument.
   *  @param options configures how the update is applied. See {@link StateUpdateOptions}.
   *  @returns a promise that resolves with the updated value read from the state.
   *   The round-trip encrypts, decrypts, and deserializes the data, producing a new
   *   object.
   *  @remarks `configureState` must return a JSON-serializable object.
   *   If there are properties of your class which are not JSON-serializable,
   *   they can be lost when the secret state updates its backing store.
   */
  async update<TCombine>(
    configureState: (state: Outer, dependencies: TCombine) => Outer,
    options: StateUpdateOptions<Outer, TCombine> = null,
  ): Promise<Outer> {
    // reactively grab the latest state from the caller. `zip` requires each
    // observable has a value, so `combined$` provides a default if necessary.
    const combined$ = options?.combineLatestWith ?? of(undefined);
    const newState$ = zip(this.plaintext.state$, combined$).pipe(
      concatMap(([currentState, combined]) =>
        this.prepareCryptoState(
          currentState,
          () => options?.shouldUpdate?.(currentState, combined) ?? true,
          () => configureState(currentState, combined),
        ),
      ),
    );

    // update the backing store
    let latestValue: Outer = null;
    await this.encrypted.update((_, [, newStoredState]) => newStoredState, {
      combineLatestWith: newState$,
      shouldUpdate: (_, [shouldUpdate, , newState]) => {
        // need to grab the latest value from the closure since the derived state
        // could return its cached value, and this must be done in `shouldUpdate`
        // because `configureState` may not run.
        latestValue = newState;
        return shouldUpdate;
      },
    });

    return latestValue;
  }

  private async prepareCryptoState(
    currentState: Outer,
    shouldUpdate: () => boolean,
    configureState: () => Outer,
  ): Promise<[boolean, ClassifiedFormat<Id, Disclosed>[], Outer]> {
    // determine whether an update is necessary
    if (!shouldUpdate()) {
      return [false, undefined, currentState];
    }

    // calculate the update
    const newState = configureState();
    if (newState === null || newState === undefined) {
      return [true, newState as any, newState];
    }

    // convert the object to a list format so that all encrypt and decrypt
    // operations are self-similar
    const desconstructed = this.key.deconstruct(newState);

    // encrypt each value individually
    const encryptTasks = desconstructed.map(async ([id, state]) => {
      const classified = this.key.classifier.classify(state);
      const encrypted = await this.encryptor.encrypt(classified.secret, this.encrypted.userId);

      // the deserializer in the plaintextState's `derive` configuration always runs, but
      // `encryptedState` is not guaranteed to serialize the data, so it's necessary to
      // round-trip it proactively. This will cause some duplicate work in those situations
      // where the backing store does deserialize the data.
      const serialized = JSON.parse(
        JSON.stringify({ id, secret: encrypted, disclosed: classified.disclosed }),
      );
      return serialized as ClassifiedFormat<Id, Disclosed>;
    });
    const serializedState = await Promise.all(encryptTasks);

    return [true, serializedState, newState];
  }
}
