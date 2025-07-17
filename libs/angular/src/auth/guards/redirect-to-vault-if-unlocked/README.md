# RedirectToVaultIfUnlocked Guard

The `redirectToVaultIfUnlocked` redirects the user to `/vault` if they are `Unlocked`. Otherwise, it allows access to the route.

This is particularly useful for routes that can handle BOTH unauthenticated AND authenticated-but-locked users (which makes the `authGuard` unusable on those routes).

<br>

### Special Use Case - Authenticating in the Extension Popout

Imagine a user is going through the Login with Device flow in the Extension pop*out*:

- They open the pop*out* while on `/login-with-device`
- The approve the login from another device
- They are authenticated and routed to `/vault` while in the pop*out*

If the `redirectToVaultIfUnlocked` were NOT applied, if this user now opens the pop*up* they would be shown the `/login-with-device`, not their `/vault`.

But by adding the `redirectToVaultIfUnlocked` to `/login-with-device` we make sure to check if the user has already `Unlocked`, and if so, route them to `/vault` upon opening the pop*up*.
