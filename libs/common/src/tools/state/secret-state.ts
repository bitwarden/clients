// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, map, concatMap, share, ReplaySubject, timer, combineLatest, of } from "rxjs";

import { EncString } from "../../platform/models/domain/enc-string";
import {
  SingleUserState,
  StateProvider,
  StateUpdateOptions,
  CombinedState,
} from "../../platform/state";
import { UserId } from "../../types/guid";
import { UserEncryptor } from "../cryptography/user-encryptor.abstraction";

import { ClassifiedFormat } from "./classified-format";
import { SecretKeyDefinition } from "./secret-key-definition";

const ONE_MINUTE = 1000 * 60;

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
    private readonly $encryptor: Observable<UserEncryptor>,
    userId: UserId,
    provider: StateProvider,
  ) {
    // construct the backing store
    this.encryptedState = provider.getUser(userId, key.toEncryptedStateKey());

    // cache plaintext
    this.combinedState$ = combineLatest([this.encryptedState.combinedState$, this.$encryptor]).pipe(
      concatMap(
        async ([[userId, state], encryptor]) =>
          [userId, await this.declassifyAll(encryptor, state)] as [UserId, Outer],
      ),
      share({
        connector: () => {
          return new ReplaySubject<[UserId, Outer]>(1);
        },
        resetOnRefCountZero: () => timer(key.options.cleanupDelayMs ?? ONE_MINUTE),
      }),
    );

    this.state$ = this.combinedState$.pipe(map(([, state]) => state));
  }

  private readonly encryptedState: SingleUserState<ClassifiedFormat<Id, Disclosed>[]>;

  /** {@link SingleUserState.userId} */
  get userId() {
    return this.encryptedState.userId;
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
    encryptor$: Observable<UserEncryptor>,
  ) {
    const secretState = new SecretState(key, encryptor$, userId, provider);
    return secretState;
  }

  private async declassifyItem(
    encryptor: UserEncryptor,
    { id, secret, disclosed }: ClassifiedFormat<Id, Disclosed>,
  ) {
    const encrypted = EncString.fromJSON(secret);
    const decrypted = await encryptor.decrypt(encrypted);

    const declassified = this.key.classifier.declassify(disclosed, decrypted);
    const result = [id, this.key.options.deserializer(declassified)] as const;

    return result;
  }

  private async declassifyAll(encryptor: UserEncryptor, data: ClassifiedFormat<Id, Disclosed>[]) {
    // fail fast if there's no value
    if (data === null || data === undefined) {
      return null;
    }

    // decrypt each item
    const decryptTasks = data.map(async (item) => this.declassifyItem(encryptor, item));

    // reconstruct expected type
    const results = await Promise.all(decryptTasks);
    const result = this.key.reconstruct(results);

    return result;
  }

  private async classifyItem(encryptor: UserEncryptor, [id, item]: [Id, Plaintext]) {
    const classified = this.key.classifier.classify(item);
    const encrypted = await encryptor.encrypt(classified.secret);

    // the deserializer in the plaintextState's `derive` configuration always runs, but
    // `encryptedState` is not guaranteed to serialize the data, so it's necessary to
    // round-trip `encrypted` proactively.
    const serialized = {
      id,
      secret: JSON.parse(JSON.stringify(encrypted)),
      disclosed: classified.disclosed,
    } as ClassifiedFormat<Id, Disclosed>;

    return serialized;
  }

  private async classifyAll(encryptor: UserEncryptor, data: Outer) {
    // fail fast if there's no value
    if (data === null || data === undefined) {
      return null;
    }

    // convert the object to a list format so that all encrypt and decrypt
    // operations are self-similar
    const desconstructed = this.key.deconstruct(data);

    // encrypt each value individually
    const classifyTasks = desconstructed.map(async (item) => this.classifyItem(encryptor, item));
    const classified = await Promise.all(classifyTasks);

    return classified;
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
    const combineLatestWith = combineLatest([
      options?.combineLatestWith ?? of(null),
      this.$encryptor,
    ]);

    // read the backing store
    let latestClassified: ClassifiedFormat<Id, Disclosed>[];
    let latestCombined: TCombine;
    let latestEncryptor: UserEncryptor;
    await this.encryptedState.update((c) => c, {
      shouldUpdate: (latest, combined) => {
        latestClassified = latest;
        [latestCombined, latestEncryptor] = combined;
        return false;
      },
      combineLatestWith,
    });

    // exit early if there's no update to apply
    const latestDeclassified = await this.declassifyAll(latestEncryptor, latestClassified);
    const shouldUpdate = options?.shouldUpdate?.(latestDeclassified, latestCombined) ?? true;
    if (!shouldUpdate) {
      return latestDeclassified;
    }

    // apply the update
    const updatedDeclassified = configureState(latestDeclassified, latestCombined);
    const updatedClassified = await this.classifyAll(latestEncryptor, updatedDeclassified);
    await this.encryptedState.update(() => updatedClassified);

    return updatedDeclassified;
  }
}
