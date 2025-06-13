# Redirect Guard

The `redirectGuard` redirects the user based on their `AuthenticationStatus`. It is applied to the root route (`/`).

<br>

### Order of Operations

The `redirectGuard` will redirect the user based on the following checks, _in order_:

- **`AuthenticationStatus.LoggedOut`** &rarr; redirect to `/login`
- **`AuthenticationStatus.Unlocked`** &rarr; redirect to `/vault`
- **`AuthenticationStatus.Locked`**
  - **TDE Locked State** &rarr; redirect to `/login-initiated`
    - A user is in a TDE Locked State if they meet all 3 of the following conditions
      1. Auth status is `Locked`
      2. TDE is enabled
      3. User has never had a user key (that is, user has not unlocked/decrypted yet)
  - **Standard Locked State** &rarr; redirect to `/lock`

<br>

| Order | AuthenticationStatus                                                            | Redirect To        |
| ----- | ------------------------------------------------------------------------------- | ------------------ |
| 1     | `LoggedOut`                                                                     | `/login`           |
| 2     | `Unlocked`                                                                      | `/vault`           |
| 3     | **TDE Locked State** <br> `Locked` + <br> `tdeEnabled` + <br> `!everHadUserKey` | `/login-initiated` |
| 4     | **Standard Locked State** <br> `Locked`                                         | `/lock`            |

<br>

### Default Routes and Route Overrides

The default redirect routes are mapped to object properties:

```typescript
const defaultRoutes: RedirectRoutes = {
  loggedIn: "/vault",
  loggedOut: "/login",
  locked: "/lock",
  notDecrypted: "/login-initiated",
};
```

But when applying the guard to the root route, the developer can override specific redirect routes by passing in a custom object. This is useful for subtle differences in client-specific routing:

```typescript
// app-routing.module.ts (Browser Extension)
{
    path: "",
    canActivate: [redirectGuard({ loggedIn: "/tabs/current"})],
}
```
