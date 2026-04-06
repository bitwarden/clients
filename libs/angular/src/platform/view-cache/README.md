# Extension Persistence

By default, when the browser extension popup closes, the user's current view and any data entered
without saving is lost. This introduces friction in several workflows within our client, such as:

- Performing actions that require email OTP entry, since the user must navigate from the popup to
  get to their email inbox
- Entering information to create a new vault item from a browser tab
- And many more

Previously, we have recommended that users "pop out" the extension into its own window to persist
the extension context, but this introduces additional user actions and may leave the extension open
(and unlocked) for longer than a user intends.

In order to provide a better user experience, we have introduced two levels of persistence to the
Bitwarden extension client:

- We persist the route history, allowing us to re-open the last route when the popup re-opens, and
- We offer a service for teams to use to persist component-specific form data or state to survive a
  popup close/re-open cycle

## Persistence lifetime

Since we are persisting data, it is important that the lifetime of that data be well-understood and
well-constrained. The cache of route history and form data is cleared when any of the following
events occur:

- The account is locked
- The account is logged out
- Account switching is used to switch the active account
- The extension popup has been closed for 2 minutes

In addition, cached form data is cleared when a browser extension navigation event occurs (e.g.
switching between tabs in the extension).

## Types of persistence

### Route history persistence

Route history is persisted on the extension automatically, with no specific implementation required
on any component.

The persistence layer ensures that the popup will open at the same route as was active when it
closed, provided that none of the lifetime expiration events have occurred.

> [!TIP]
> If a particular route should be excluded from the history and not persisted, add
> `doNotSaveUrl: true` to the `data` property on the route.

### View data persistence

Route persistence ensures that the user will land back on the route that they were on when the popup
closed, but it does not persist any state or form data that the user may have modified. In order to
persist that data, the component is responsible for registering that data with the
[`ViewCacheService`](./view-cache.service.ts).
This is done prescriptively to ensure that only necessary data is cached and that it is done with
intention by the component.

The `ViewCacheService` provides an interface for caching both individual state and `FormGroup`s.

#### Caching individual data elements

For individual pieces of state, use the `signal()` method on the `ViewCacheService` to create a
writeable [signal](https://angular.dev/guide/signals) wrapper around the desired state.

```typescript
const mySignal = this.viewCacheService.signal({
    key: "my-state-key"
    initialValue: null
});
```

If a cached value exists, the returned signal will contain the cached data.

Setting the value should be done through the signal's `set()` method:

```typescript
const mySignal = this.viewCacheService.signal({
    key: "my-state-key"
    initialValue: null
});
mySignal.set("value")
```

> [!NOTE]
> By default, signals use `Object.is` to determine equality, and `set()` will only trigger updates if
> the updated value is not equal to the current signal state. See documentation
> [here](https://angular.dev/guide/signals#signal-equality-functions).

Putting this together, the most common implementation pattern would be:

1. **Register the signal** using `ViewCacheService.signal()` on initialization of the component or
   service responsible for the state being persisted.
2. **Restore state from the signal:** If cached data exists, the signal will contain that data. The
   component or service should use this data to re-create the state from prior to the popup closing.
3. **Set new state** in the cache when it changes. Ensure that any updates to the data are persisted
   to the cache with `set()`, so that the cache reflects the latest state.

#### Caching form data

For persisting form data, the `ViewCacheService` supplies a `formGroup()` method, which manages the
persistence of any entered form data to the cache and the initialization of the form from the cached
data. You can supply the `FormGroup` in the `control` parameter of the method, and the
`ViewCacheService` will:

- Initialize the form the a cached value, if it exists
- Save form value to cache when it changes
- Mark the form dirty if the restored value is not `undefined`.

```typescript
this.loginDetailsForm = this.viewCacheService.formGroup({
  key: "my-form",
  control: this.formBuilder.group({
    username: [""],
    email: [""],
  }),
});
```

## What about other clients?

The `ViewCacheService` is designed to be injected into shared, client-agnostic components. A
`NoopViewCacheService` is provided and injected for non-extension clients, preserving a single
interface for your components.
