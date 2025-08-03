# `@bitwarden/state`

# State Provider Framework

The state provider framework was designed for the purpose of allowing state to be owned by domains
but also to enforce good practices, reduce boilerplate around account switching, and provide a
trustworthy observable stream of that state.

## APIs

- [Storage definitions](#storage-definitions)
  - [`StateDefinition`](#statedefinition)
  - [`KeyDefinition` & `UserKeyDefinition`](#keydefinition-and-userkeydefinition)
- [`StateProvider`](#stateprovider)
- [`Update`](#updating-state-with-update)
- [`GlobalState<T>`](#globalstatet)
- [`SingleUserState<T>`](#singleuserstatet)
- [`ActiveUserState<T>`](#activeuserstatet)

### Storage definitions

In order to store and retrieve data, we need to have constant keys to reference storage locations.
This includes a storage medium (disk or memory) and a unique key. `StateDefinition` and
`KeyDefinition` classes allow for reasonable reuse of partial namespaces while also enabling
expansion to precise keys. They exist to help minimize the potential of overlaps in a distributed
storage framework.

> [!WARNING]
> Once you have created the definitions you need to take extreme caution when changing any part of the
> namespace. If you change the name of a `StateDefinition` pointing at `"disk"` without also migrating
> data from the old name to the new name you will lose data. Data pointing at `"memory"` can have its
> name changed.

#### `StateDefinition`

> [!NOTE]
> Secure storage is not currently supported as a storage location in the State Provider Framework. For
> now, don't migrate data that is stored in secure storage but please contact the Platform team when
> you have data you wanted to migrate so we can prioritize a long-term solution. If you need new data
> in secure storage, use `StateService` for now.

`StateDefinition` is a simple API but a very core part of making the State Provider Framework work
smoothly. It defines a storage location and top-level namespace for storage. Teams will interact
with it only in a single `state-definitions.ts` file in the
[`clients`](https://github.com/bitwarden/clients) repository. This file is located under Platform
team code ownership but teams are expected to create edits to it. A team will edit this file to
include a line such as:

```typescript
export const MY_DOMAIN_DISK = new StateDefinition("myDomain", "disk");
```

The first argument to the `StateDefinition` constructor is expected to be a human readable,
camelCase-formatted name for your domain or state area. The second argument will either be the
string literal `"disk"` or `"memory"` dictating where all the state using this `StateDefinition`
should be stored.

The Platform team is responsible for reviewing all new and updated entries in this file and makes
sure that there are no duplicate entries containing the same state name and state location. Teams
are able to have the same state name used for both `"disk"` and `"memory"` locations. Tests are
included to ensure this uniqueness and core naming guidelines so teams can ensure a review for a new
`StateDefinition` entry is done promptly and with very few surprises.

##### Client-specific storage locations

An optional third parameter to the `StateDefinition` constructor is provided if you need to specify
client-specific storage location for your state.

This will most commonly be used to handle the distinction between session and local storage on the
web client. The default `"disk"` storage for the web client is session storage, and local storage
can be specified by defining your state as:

```typescript
export const MY_DOMAIN_DISK = new StateDefinition("myDomain", "disk", { web: "disk-local" });
```

#### `KeyDefinition` and `UserKeyDefinition`

`KeyDefinition` and `UserKeyDefinition` build on the [`StateDefinition`](#statedefinition),
specifying a single element of state data within the `StateDefinition`.

The framework provides both `KeyDefinition` and `UserKeyDefinition` for teams to use. Use
`UserKeyDefinition` for state scoped to a user and `KeyDefinition` for user-independent state. These
will be consumed via the [`SingleUserState<T>`](#singleuserstatet) or
[`ActiveUserState<T>`](#activeuserstatet) within your consuming services and components. The
`UserKeyDefinition` extends the `KeyDefinition` and provides a way to specify how the state will be
cleaned up on specific user account actions.

`KeyDefinition`s and `UserKeyDefinition`s can also be instantiated in your own team's code. This
might mean creating it in the same file as the service you plan to consume it or you may want to
have a single `key-definitions.ts` file that contains all the entries for your team. Some example
instantiations are:

```typescript
const MY_DOMAIN_DATA = new UserKeyDefinition<MyState>(MY_DOMAIN_DISK, "data", {
  // convert to your data from serialized representation `{ foo: string }` to fully-typed `MyState`
  deserializer: (jsonData) => MyState.fromJSON(jsonData),
  clearOn: ["logout"], // can be lock, logout, both, or an empty array
});

// Or if your state is an array, use the built-in helper
const MY_DOMAIN_DATA: UserKeyDefinition<MyStateElement[]> = UserKeyDefinition.array<MyStateElement>(
  MY_DOMAIN_DISK,
  "data",
  {
    deserializer: (jsonDataElement) => MyState.fromJSON(jsonDataElement), // provide a deserializer just for the element of the array
  },
  {
    clearOn: ["logout"],
  },
);

// record
const MY_DOMAIN_DATA: UserKeyDefinition<Record<string, MyStateElement>> =
  KeyDefinition.record<MyStateValue>(MY_DOMAIN_DISK, "data", {
    deserializer: (jsonDataValue) => MyState.fromJSON(jsonDataValue), // provide a deserializer just for the value in each key-value pair
    clearOn: ["logout"],
  });
```

The arguments for defining a `KeyDefinition` or `UserKeyDefinition` are:

| Argument          | Usage                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stateDefinition` | The `StateDefinition` to which that this key belongs                                                                                                                                              |
| `key`             | A human readable, camelCase-formatted name for the key definition. This name should be unique amongst all other `KeyDefinition`s or `UserKeyDefinition`s that consume the same `StateDefinition`. |
| `options`         | An object of type [`KeyDefinitionOptions`](#key-definition-options) or [`UserKeyDefinitionOptions`](#key-definition-options), which defines the behavior of the key.                              |

> [!WARNING]
> It is the responsibility of the team to ensure the uniqueness of the `key` within a
> `StateDefinition`. As such, you should never consume the `StateDefinition` of another team in your
> own key definition.

##### Key Definition Options

| Option           | Required?                    | Usage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deserializer`   | Yes                          | Takes a method that gives you your state in it's JSON format and makes you responsible for converting that into JSON back into a full JavaScript object, if you choose to use a class to represent your state that means having its prototype and any method you declare on it. If your state is a simple value like `string`, `boolean`, `number`, or arrays of those values, your deserializer can be as simple as `data => data`. But, if your data has something like `Date`, which gets serialized as a string you will need to convert that back into a `Date` like: `data => new Date(data)`. |
| `cleanupDelayMs` | No                           | Takes a number of milliseconds to wait before cleaning up the state after the last subscriber has unsubscribed. Defaults to 1000ms. When this is set to 0, no `share()` is used on the underlying observable stream.                                                                                                                                                                                                                                                                                                                                                                                 |
| `clearOn`        | Yes, for `UserKeyDefinition` | An additional parameter provided for `UserKeyDefinition` **only**, which allows specification of the user account `ClearEvent`s that will remove the piece of state from persistence. The available values for `ClearEvent` are `logout`, `lock`, or both. An empty array should be used if the state should not ever be removed (e.g. for settings).                                                                                                                                                                                                                                                |

### `StateProvider`

`StateProvider` is an injectable service that includes four methods for getting state, expressed in
the type definition below:

```typescript
interface StateProvider {
  getGlobal<T>(keyDefinition: KeyDefinition<T>): GlobalState<T>;
  getUser<T>(userId: UserId, keyDefinition: KeyDefinition<T>): SingleUserState<T>;
  getDerived<TFrom, TTo, TDeps>(
    parentState$: Observable<TFrom>,
    deriveDefinition: DeriveDefinition<TFrom, TTo, TDeps>,
    dependenciess: TDeps,
  );
  // Deprecated, do not use.
  getActive<T>(keyDefinition: KeyDefinition<T>): ActiveUserState<T>;
}
```

These methods are helpers for invoking their more modular siblings `SingleUserStateProvider.get`,
`GlobalStateProvider.get`, `DerivedStateProvider.get`, and `ActiveUserStateProvider.get`. These siblings
can all be injected into your service as well. If you prefer thin dependencies over the slightly
larger changeset required, you can absolutely make use of the more targeted providers.

> [!WARNING] > `ActiveUserState` is deprecated
>
> The `ActiveUserStateProvider.get` and its helper `getActive<T>` are deprecated. See
> [here](#should-i-use-activeuserstate) for details.

You will most likely use `StateProvider` in a domain service that is responsible for managing the
state, with the state values being scoped to a single user. The `StateProvider` should be injected
as a `private` member into the class, with the `getUser()` helper method to retrieve the current
state value for the provided `userId`. See a simple example below:

```typescript
import { DOMAIN_USER_STATE } from "../key-definitions";

class DomainService {
  constructor(private stateProvider: StateProvider) {}

  private getStateValue(userId: UserId): SingleUserState<DomainObject> {
    return this.stateProvider.getUser(userId, DOMAIN_USER_STATE);
  }

  async clearStateValue(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, DOMAIN_USER_STATE).update((state) => null);
  }
}
```

Each of the methods on the `StateProvider` will return an object typed based on the state requested:

#### `GlobalState<T>`

`GlobalState<T>` is an object to help you maintain and view the state of global-scoped storage. You
can see the type definition of the API on `GlobalState<T>` below:

```typescript
interface GlobalState<T> {
  state$: Observable<T | null>;
}
```

The `state$` property provides you with an `Observable<T | null>` that can be subscribed to.
`GlobalState<T>.state$` will emit when the chosen storage location emits an update to the state
defined by the corresponding `KeyDefinition`.

#### `SingleUserState<T>`

`SingleUserState<T>` behaves very similarly to `GlobalState<T>`, but for state that is defined as
user-scoped with a `UserKeyDefinition`. The `UserId` for the state's user exposed as a `readonly`
member.

The `state$` property provides you with an `Observable<T | null>` that can be subscribed to.
`SingleUserState<T>.state$` will emit when the chosen storage location emits an update to the state
defined by the corresponding `UserKeyDefinition` for the requested `userId`.

> [!NOTE]
> Updates to `SingleUserState` or `ActiveUserState` handling the same `KeyDefinition` will cause each
> other to emit on their `state$` observables if the `userId` handled by the `SingleUserState` happens
> to be active at the time of the update.

### `DerivedState<T>`

For details on how to use derived state, see [Derived State](#derived-state).

### `ActiveUserState<T>`

> [!WARNING] > `ActiveUserState` has race condition problems. Do not add usages and consider transitioning your
> code to SingleUserState instead. [Read more.](#should-i-use-activeuserstate)

`ActiveUserState<T>` is an object to help you maintain and view the state of the currently active
user. If the currently-active user changes, like through account switching, the data this object
represents will change along with it.

### Updating state with `update`

The update method has options defined as follows:

```typescript
{ActiveUser|SingleUser|Global}State<T> {
  // ... rest of type left out for brevity
  update<TCombine>(updateState: (state: T, dependency: TCombine) => T, options?: StateUpdateOptions);
}

type StateUpdateOptions = {
  shouldUpdate?: (state: T, dependency: TCombine) => boolean;
  combineLatestWith?: Observable<TCombine>;
  msTimeout?: number
}
```

> [!WARNING] > `firstValueFrom()` and state updates
>
> A usage pattern of updating state and then immediately requesting a value through `firstValueFrom()` > **will not always result in the updated value being returned**. This is because we cannot guarantee
> that the update has taken place before the `firstValueFrom()` executes, in which case the previous
> (cached) value of the observable will be returned.
>
> Use of `firstValueFrom()` should be avoided. If you find yourself trying to use `firstValueFrom()`,
> consider propagating the underlying observable instead of leaving reactivity.
>
> If you do need to obtain the result of an update in a non-reactive way, you should use the result  
> returned from the `update()` method. The `update()` will return the value that will be persisted
> to  
> state, after any `shouldUpdate()` filters are applied.

#### Using `shouldUpdate` to filter unnecessary updates

We recommend using `shouldUpdate` when possible. This will avoid unnecessary I/O for redundant
updates and avoid an unnecessary emission of `state$`. The `shouldUpdate` method gives you in its
first parameter the value of state before any change has been made, and the dependency you have,
optionally, provided through `combineLatestWith`.

If your state is a simple JavaScript primitive type, this can be done with the strict equality
operator (`===`):

```typescript
const USES_KEYCONNECTOR: UserKeyDefinition<boolean> = ...;

async setUsesKeyConnector(value: boolean, userId: UserId) {
  // Only do the update if the current value saved in state
  // differs in equality of the incoming value.
  await this.stateProvider.getUser(userId, USES_KEYCONNECTOR).update(
    currentValue => currentValue !== value
  );
}
```

For more complex state, implementing a custom equality operator is recommended. It's important that
if you implement an equality function that you then negate the output of that function for use in
`shouldUpdate()` since you will want to go through the update when they are NOT the same value.

```typescript
type Cipher = { id: string, username: string, password: string, revisionDate: Date };
const LAST_USED_CIPHER: UserKeyDefinition<Cipher> = ...;

async setLastUsedCipher(lastUsedCipher: Cipher | null, userId: UserId) {
  await this.stateProvider.getUser(userId, LAST_USED_CIPHER).update(
    currentValue => !this.areEqual(currentValue, lastUsedCipher)
  );
}

areEqual(a: Cipher | null, b: Cipher | null) {
  if (a == null) {
    return b == null;
  }

  if (b == null) {
    return false;
  }

  // Option one - Full equality, comparing every property for value equality
  return a.id === b.id &&
    a.username === b.username &&
    a.password === b.password &&
    a.revisionDate === b.revisionDate;

  // Option two - Partial equality based on requirement that any update would
  // bump the revision date.
  return a.id === b.id && a.revisionDate === b.revisionDate;
}
```

#### Using `combineLatestWith` option to control updates

The `combineLatestWith` option can be useful when updates to your state depend on the data from
another stream of data.

For example, if we were asked to set a `userId` to the active account only if that `userId` exists
in our known accounts list, an initial approach could do the check as follows:

```typescript
const accounts = await firstValueFrom(this.accounts$);
if (accounts?.[userId] == null) {
  throw new Error();
}
await this.activeAccountIdState.update(() => userId);
```

However, this implementation has a few subtle issues that the `combineLatestWith` option addresses:

- The use of `firstValueFrom` with no `timeout`. Behind the scenes we enforce that the observable
  given to `combineLatestWith` will emit a value in a timely manner, in this case a `1000ms`
  timeout, but that number is configurable through the `msTimeout` option.
- We don't guarantee that your `updateState` callback is called the instant that the `update` method
  is called. We do, however, promise that it will be called before the returned promise resolves or
  rejects. This may be because we have a lock on the current storage key. No such locking mechanism
  exists today but it may be implemented in the future. As such, it is safer to use
  `combineLatestWith` because the data is more likely to retrieved closer to when it needs to be
  evaluated.

We recommend instead using the `combineLatestWith` option within the `update()` method to address
these issues:

```typescript
await this.activeAccountIdState.update(
  (_, accounts) => {
    if (userId == null) {
      // indicates no account is active
      return null;
    }
    if (accounts?.[userId] == null) {
      throw new Error("Account does not exist");
    }
    return userId;
  },
  {
    combineLatestWith: this.accounts$,
    shouldUpdate: (id) => {
      // update only if userId changes
      return id !== userId;
    },
  },
);
```

`combineLatestWith` can also be used to handle updates where either the new value depends on `async`
code or you prefer to handle generation of a new value in an observable transform flow:

```typescript
const state = this.stateProvider.get(userId, SavedFiltersStateDefinition);

const transform: OperatorFunction<any, any> = pipe(
  // perform some transforms
  map((value) => value),
);

async function transformAsync<T>(value: T) {
  return Promise.resolve(value);
}

await state.update((_, newState) => newState, {
  // Actual processing to generate the new state is done here
  combineLatestWith: state.state$.pipe(
    mergeMap(async (old) => {
      return await transformAsync(old);
    }),
    transform,
  ),
  shouldUpdate: (oldState, newState) => !areEqual(oldState, newState),
});
```

#### Conditions under which emission not guaranteed after `update()`

The `state$` property is **not guaranteed** to emit a value after an update where the value would
conventionally be considered equal. It _is_ emitted in many cases but not guaranteed. The reason for
this is because we leverage on platform APIs to initiate state emission. In particular, we use the
`chrome.storage.{area}.onChanged` event to facilitate the `state$` observable in the extension
client, and Chrome won’t emit a change if the value is the same. You can easily see this with the
below instructions:

```
chrome.storage.local.onChanged.addListener(console.log);
chrome.storage.local.set({ key: true });
chrome.storage.local.set({ key: true });
```

The second instance of calling `set` will not log a changed event. As a result, the `state$` relying
on this value will not emit. Due to nuances like this, using a `StateProvider` as an event stream is
discouraged, and we recommend using [`MessageSender`](https://github.com/bitwarden/clients/blob/main/libs/messaging/src/message.sender.ts) for events that you always want sent to
subscribers.

## Testing

Testing business logic with data and observables can sometimes be cumbersome. To help make that a
little easier there are a suite of helpful "fakes" that can be used instead of traditional "mocks".
Now instead of calling `mock<StateProvider>()` into your service you can instead use
`new FakeStateProvider()`.

`FakeStateProvider` exposes the specific provider's fakes as properties on itself. Each of those
specific providers gives a method `getFake` that allows you to get the fake version of state that
you can control and `expect`.

## Migrating

Migrating data to state providers is incredibly similar to migrating data in general. You create
your own class that extends `Migrator<From, To>`. That will require you to implement your own
`migrate(migrationHelper: MigrationHelper)` method. `MigrationHelper` already includes methods like
`get` and `set` for getting and settings value to storage by their string key. There are also
methods for getting and setting using your `KeyDefinition` or `KeyDefinitionLike` object to and from
user and global state.

For examples of migrations, you can reference the
[existing](https://github.com/bitwarden/clients/tree/main/libs/common/src/state-migrations/migrations)
migrations list.

## FAQ

### Do I need to have my own in-memory cache?

If you previously had a memory cache that exactly represented the data you stored on disk (not
decrypted for example), then you likely don't need that anymore. All the `*State` classes maintain
an in memory cache of the last known value in state for as long as someone is subscribed to the
data. The cache is cleared after 1000ms of no one subscribing to the state though. If you know you
have sporadic subscribers and a high cost of going to disk you may increase that time using the
`cleanupDelayMs` on `KeyDefinitionOptions`.

### I store my data as a Record / Map but expose it as an array -- what should I do?

Give `KeyDefinition<T>` generic the record shape you want, or even use the static `record` helper
method. Then to convert that to an array that you expose just do a simple
`.pipe(map(data => this.transform(data)))` to convert that to the array you want to expose.

### Why `KeyDefinitionLike`?

`KeyDefinitionLike` exists to help you create a frozen-in-time version of your `KeyDefinition`. This
is helpful in state migrations so that you don't have to import something from the greater
application which is something that should rarely happen.

### When does my deserializer run?

The `deserialier` that you provide in the `KeyDefinitionOptions` is used whenever your state is
retrieved from a storage service that stores its data as JSON. All disk storage services serialize
data into JSON but memory storage differs in this area across platforms. That's why it's imperative
to include a high quality JSON deserializer even if you think your object will only be stored in
memory. This can mean you might be able to drop the `*Data` class pattern for your code. Since the
`*Data` class generally represented the JSON safe version of your state which we now do
automatically through the `Jsonify<T>` given to your in your `deserializer` method.

### Should I use `ActiveUserState`?

Probably not, `ActiveUserState` is either currently in the process of or already completed the
removal of its `update` method. This will effectively make it readonly, but you should consider
maybe not even using it for reading either. `update` is actively bad, while reading is just not as
dynamic of a API design.

Take the following example:

```typescript
private folderState: ActiveUserState<Record<string, Folder>>

renameFolder(folderId: string, newName: string) {
  // Get state
  const folders = await firstValueFrom(this.folderState.state$);
  // Mutate state
  folders[folderId].name = await encryptString(newName);
  // Save state
  await this.folderState.update(() => folders);
}
```

You can imagine a scenario where the active user changes between the read and the write. This would
be a big problem because now user A's folders was stored in state for user B. By taking a user id
and utilizing `SingleUserState` instead you can avoid this problem by passing ensuring both
operation happen for the same user. This is obviously an extreme example where the point between the
read and write is pretty minimal but there are places in our application where the time between is
much larger. Maybe information is read out and placed into a form for editing and then the form can
be submitted to be saved.

The first reason for why you maybe shouldn't use `ActiveUserState` for reading is for API
flexibility. Even though you may not need an API to return the data of a non-active user right now,
you or someone else may want to. If you have a method that takes the `UserId` then it can be
consumed by someone passing in the active user or by passing a non-active user. You can now have a
single API that is useful in multiple scenarios.

The other reason is so that you can more cleanly switch users to new data when multiple streams are
in play. Consider the following example:

```typescript
const view$ = combineLatest([
  this.folderService.activeUserFolders$,
  this.cipherService.activeUserCiphers$,
]).pipe(map(([folders, ciphers]) => buildView(folders, ciphers)));
```

Since both are tied to the active user, you will get one emission when first subscribed to and
during an account switch, you will likely get TWO other emissions. One for each, inner observable
reacting to the new user. This could mean you try to combine the folders and ciphers of two
accounts. This is ideally not a huge issue because the last emission will have the same users data
but it's not ideal, and easily avoidable. Instead you can write it like this:

```typescript
const view$ = this.accountService.activeAccount$.pipe(
  switchMap((account) => {
    if (account == null) {
      throw new Error("This view should only be viewable while there is an active user.");
    }

    return combineLatest([
      this.folderService.userFolders$(account.id),
      this.cipherService.userCiphers$(account.id),
    ]);
  }),
  map(([folders, ciphers]) => buildView(folders, ciphers)),
);
```

You have to write a little more code but you do a few things that might force you to think about the
UX and rules around when this information should be viewed. With `ActiveUserState` it will simply
not emit while there is no active user. But with this, you can choose what to do when there isn't an
active user and you could simple add a `first()` to the `activeAccount$` pipe if you do NOT want to
support account switching. An account switch will also emit the `combineLatest` information a single
time and the info will be always for the same account.

## Structure

![State Diagram](State_Diagram.svg)

## Derived State

It is common to need to cache the result of expensive work that does not represent true alterations
in application state. Derived state exists to store this kind of data in memory and keep it up to
date when the underlying observable state changes.

## `DeriveDefinition`

Derived state has all of the same issues with storage and retrieval that normal state does. Similar
to `KeyDefinition`, derived state depends on `DeriveDefinition`s to define magic string keys to
store and retrieve data from a cache. Unlike normal state, derived state is always stored in memory.
It still takes a `StateDefinition`, but this is used only to define a namespace for the derived
state, the storage location is ignored. _This can lead to collisions if you use the same key for two
different derived state definitions in the same namespace._

Derive definitions can be created in two ways:

<a name="deriveDefinitionFactories"></a>

```typescript
new DeriveDefinition(STATE_DEFINITION, "uniqueKey", _DeriveOptions_);

// or

const keyDefinition: KeyDefinition<T>;
DeriveDefinition.from(keyDefinition, _DeriveOptions_);
```

The first allows building from basic building blocks, the second recognizes that derived state is
often built from existing state and allows you to create a definition from an existing
`KeyDefinition`. The resulting `DeriveDefinition` will have the same state namespace, key, and
`TFrom` type as the `KeyDefinition` it was built from.

### Type Parameters

`DeriveDefinition`s have three type parameters:

- `TFrom`: The type of the state that the derived state is built from.
- `TTo`: The type of the derived state.
- `TDeps`: defines the dependencies required to derive the state. This is further discussed in
  [Derive Definition Options](#derivedefinitionoptions).

### `DeriveDefinitionOptions`

[The `DeriveDefinition` section](#deriveDefinitionFactories) specifies a third parameter as
`_DeriveOptions_`, which is used to fully specify the way to transform `TFrom` to `TTo`.

- `deserializer` - For the same reasons as [Key Definition Options](#keydefinitionoptions),
  `DeriveDefinition`s require have a `deserializer` function that is used to convert the stored data
  back into the `TTo` type.
- `derive` - A function that takes the current state and returns the derived state. This function
  takes two parameters:
  - `from` - The latest value of the parent state.
  - `deps` - dependencies used to instantiate the derived state. These are provided when the
    `DerivedState` class is instantiated. This object should contain all of the application runtime
    dependencies for transform the from parent state to the derived state.
- `cleanupDelayMs` (optional) - Takes the number of milliseconds to wait before cleaning up the
  state after the last subscriber unsubscribes. Defaults to 1000ms. If you have a particularly
  expensive operation, such as decryption of a vault, it may be worth increasing this value to avoid
  unnecessary recomputation.

Specifying dependencies required for your `derive` function is done through the type parameters on
`DerivedState`.

```typescript
new DerivedState<TFrom, TTo, { example: Dependency }>();
```

would require a `deps` object with an `example` property of type `Dependency` to be passed to any
`DerivedState` configured to use the `DerivedDefinition`.

> [!WARNING]
> Both `derive` and `deserializer` functions should take null inputs into consideration. Both parent
> state and stored data for deserialization can be `null` or `undefined`.

## `DerivedStateProvider`

The `DerivedState<TFrom, TTo, TDeps>` class has a purpose-built provider which instantiates the
correct `DerivedState` implementation for a given application context. These derived states are
cached within a context, so that multiple instances of the same derived state will share the same
underlying cache, based on the `DeriveDefinition` used to create them.

Instantiating a `DerivedState` instance requires an observable parent state, the derive definition,
and an object containing the dependencies defined in the `DeriveDefinition` type parameters.

```typescript
interface DerivedStateProvider {
  get: <TFrom, TTo, TDeps extends DerivedStateDependencies>(
    parentState$: Observable<TFrom>,
    deriveDefinition: DeriveDefinition<TFrom, TTo, TDeps>,
    dependencies: TDeps,
  ) => DerivedState<TTo>;
}
```

> [!TIP]
> Any observable can be used as the parent state. If you need to perform some kind of work on data
> stored to disk prior to sending to your `derive` functions, that is supported.

## `DerivedState`

`DerivedState` is intended to be built with a provider rather than directly instantiated. The
interface consists of two items:

```typescript
interface DerivedState<T> {
  state$: Observable<T>;
  forceValue(value: T): Promise<T>;
}
```

- `state$` - An observable that emits the current value of the derived state and emits new values
  whenever the parent state changes.
- `forceValue` - A function that takes a value and immediately sets `state$` to that value. This is
  useful for clearing derived state from memory without impacting the parent state, such as during
  logout.

> [!NOTE] > `forceValue` forces `state$` _once_. It does not prevent the derived state from being recomputed
> when the parent state changes.
