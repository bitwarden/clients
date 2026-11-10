# Deep-link Guard

The `deep-link.guard.ts` supports users who are trying to access a protected route from an unauthenticated or locked state.

This guard will persist the protected URL to session state when a user is either unauthenticated or in an encrypted/locked state. This allows users to have multiple tabs of the application running simultaneously without interfering with 'previousUrl` functionality.

Writing to session state allows users who are authenticating through SSO to be routed to their identity provider and back without losing the protected route they were trying to access in the first place.

The deep link guard persists the URL of the route it is attached to. Attach it only to routes a user can deep link to, never to routes in the middle of authentication or decryption (e.g. `/lock`, `/login-initiated`). SSO users authenticate with their IdP, then pass through those routes before they are unlocked; a guard on those routes would overwrite the deep link they started with.

## General operation

The `deep-link.guard.ts` will always return true. The `deep-link.guard.ts` will only persist a URL if the user is in an unauthenticated or locked state. The persisted URL is cleared from state when it is read.

## Routes to protect

The deep link guards should be used on routes where a user will be navigated to a protected route but may not be authenticated, decrypted, or have an account.

A use cases is the `emergency-access` route which is a link that is sent to the user's email address, and in order for them to accept the request, they must first authenticate and decrypt.
