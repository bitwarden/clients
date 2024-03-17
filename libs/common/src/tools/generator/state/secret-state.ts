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

import { UserEncryptor } from "./user-encryptor.abstraction";

/** Describes the structure of data stored by the SecretState's
 *  encrypted state. Notably, this interface ensures that `Disclosed`
 *  round trips through JSON serialization.
 */
type ClassifiedFormat<Disclosed> = {
  /** Serialized {@link EncString} of the secret state's
   *  secret-level classified data.
   */
  secret: string;
  /** serialized representation of the secret state's
   * disclosed-level classified data.
   */
  disclosed: Jsonify<Disclosed>;
};

/** Stores account-specific secrets protected by a UserKeyEncryptor.
 *
 *  @remarks This state store changes the structure of `Plaintext` during
 *  storage, and requires user keys to operate. It is incompatible with sync,
 *  which expects the disk storage format to be identical to the sync format.
 *
 *  DO NOT USE THIS for synchronized data.
 */
export class SecretState<Plaintext extends object, Disclosed>
  implements SingleUserState<Plaintext>
{
  // The constructor is private to avoid creating a circular dependency when
  // wiring the derived and secret states together.
  private constructor(
    private readonly encryptor: UserEncryptor<Plaintext, Disclosed>,
    private readonly encrypted: SingleUserState<ClassifiedFormat<Disclosed>>,
    private readonly plaintext: DerivedState<Plaintext>,
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
  readonly state$: Observable<Plaintext>;

  /** {@link SingleUserState.combinedState$} */
  readonly combinedState$: Observable<CombinedState<Plaintext>>;

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
  static from<TFrom extends object, Disclosed>(
    userId: UserId,
    key: KeyDefinition<TFrom>,
    provider: StateProvider,
    encryptor: UserEncryptor<TFrom, Disclosed>,
  ) {
    // construct encrypted backing store while avoiding collisions between the derived key and the
    // backing storage key.
    const secretKey = new KeyDefinition<ClassifiedFormat<Disclosed>>(key.stateDefinition, key.key, {
      cleanupDelayMs: key.cleanupDelayMs,
      // FIXME: When the fakes run deserializers and serialization can be guaranteed through
      // state providers, decode `jsonValue.secret` instead of it running in `derive`.
      deserializer: (jsonValue) => jsonValue as ClassifiedFormat<Disclosed>,
    });
    const encryptedState = provider.getUser(userId, secretKey);

    // construct plaintext store
    const plaintextDefinition = DeriveDefinition.from<ClassifiedFormat<Disclosed>, TFrom>(
      secretKey,
      {
        derive: async (from) => {
          // fail fast if there's no value
          if (from === null || from === undefined) {
            return null;
          }

          // otherwise forward the decrypted data to the caller's derive implementation
          const secret = EncString.fromJSON(from.secret);
          const decrypted = await encryptor.decrypt(secret, from.disclosed, encryptedState.userId);
          const result = key.deserializer(decrypted) as TFrom;

          return result;
        },
        // wire in the caller's deserializer for memory serialization
        deserializer: key.deserializer,
        // cache the decrypted data in memory
        cleanupDelayMs: key.cleanupDelayMs,
      },
    );
    const plaintextState = provider.getDerived(encryptedState.state$, plaintextDefinition, null);

    // wrap the encrypted and plaintext states in a `SecretState` facade
    const secretState = new SecretState(encryptor, encryptedState, plaintextState);
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
    configureState: (state: Plaintext, dependencies: TCombine) => Plaintext,
    options: StateUpdateOptions<Plaintext, TCombine> = null,
  ): Promise<Plaintext> {
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
    let latestValue: Plaintext = null;
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
    currentState: Plaintext,
    shouldUpdate: () => boolean,
    configureState: () => Plaintext,
  ): Promise<[boolean, ClassifiedFormat<Disclosed>, Plaintext]> {
    // determine whether an update is necessary
    if (!shouldUpdate()) {
      return [false, undefined, currentState];
    }

    // calculate the update
    const newState = configureState();
    if (newState === null || newState === undefined) {
      return [true, newState as any, newState];
    }

    // the encrypt format *is* the storage format, so if the shape of that data changes,
    // this needs to map it explicitly for compatibility purposes.
    const newStoredState = await this.encryptor.encrypt(newState, this.encrypted.userId);

    // the deserializer in the plaintextState's `derive` configuration always runs, but
    // `encryptedState` is not guaranteed to serialize the data, so it's necessary to
    // round-trip it proactively. This will cause some duplicate work in those situations
    // where the backing store does deserialize the data.
    //
    // FIXME: Once there's a backing store configuration setting guaranteeing serialization,
    // remove this code and configure the backing store as appropriate.
    const serializedState = JSON.parse(JSON.stringify(newStoredState));

    return [true, serializedState, newState];
  }
}
