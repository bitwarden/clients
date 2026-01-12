# Deep-link Guard

The `deep-link.guard.ts` supports users who are trying to access a protected route from an unauthenticated or locked state.

This guard will persist the protected URL to session state when a user is either unauthenticated or in an encrypted/locked state. This allows users to have multiple tabs of the application running simultaneously without interfering with 'previousUrl` functionality.

Writing to session state allows users who are authenticating through SSO to be routed to their identity provider and back without losing the protected route they were trying to access in the first place.

The deep link guard will not persist Urls that are in the middle of authentication or decryption. SSO users will sometimes have to decrypt their vault after a successful authentication. This is why we do not persist the `/lock` route.

## General operation

The `deep-link.guard.ts` will always return true. The `deep-link.guard.ts` will only persist a URL if the user is in an unauthenticated or locked state. The URL cannot contain `/lock` or `/login-initiated`. The persisted URL is cleared from state when it is read.

## Routes to protect

The deep link guards should be used on routes where a user will be navigated to a protected route but may not be authenticated, decrypted, or have an account.

A use cases is the `emergency-access` route which is a link that is sent to the user's email address, and in order for them to accept the request, they must first authenticate and decrypt.

## TDE Users decrypting/unlocking with password

For TDE users opting to decrypt with a password they will be routed from the `login-initiated` to the `lock` route. We ignore the `login-initiated` route for this reason allowing TDE users who decrypt/unlock with a password to still be navigated to the initial request.
