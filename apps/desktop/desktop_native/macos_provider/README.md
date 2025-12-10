# Explainer: Mac OS Native Passkey Provider

This document describes the changes introduced in https://github.com/bitwarden/clients/pull/13963, where we introduce the MacOS Native Passkey Provider. It gives the high level explanation of the architecture and some of the quirks and additional good to know context.

## The high level
MacOS has native APIs (similar to iOS) to allow Credential Managers to provide credentials to the MacOS autofill system (in the PR referenced above, we only provide passkeys).

We’ve written a Swift-based native autofill-extension. It’s bundled in the app-bundle in PlugIns, similar to the safari-extension.

This swift extension currently communicates with our Electron app through IPC based on a unix socket. The IPC implementation is done in Rust and utilized through UniFFI + NAPI bindings.

Footnotes:

* We're not using the IPC framework as the implementation pre-dates the IPC framework.
* Alternatives like XPC or CFMessagePort may have better support for when the app is sandboxed. 

Electron receives the messages and passes it to Angular (through the electron-renderer event system).

Our existing fido2 services in the renderer respond to events, displaying UI as necessary, and returns the signature back through the same mechanism, allowing people to authenticate with passkeys through the native system + UI. See [Mac OS Native Passkey Workflows](https://bitwarden.atlassian.net/wiki/spaces/EN/pages/1828356098/Mac+OS+Native+Passkey+Workflows) for demo videos.

## Typescript + UI implementations

We utilize the same FIDO2 implementation and interface that is already present for our browser authentication. It was designed by @coroiu with multiple ‘ui environments' in mind.

Therefore, a lot of the plumbing is implemented in /autofill/services/desktop-fido2-user-interface.service.ts, which implements the interface that our fido2 authenticator/client expects to drive UI related behaviors. 

We’ve also implemented a couple FIDO2 UI components to handle registration/sign in flows, but also improved the “modal mode” of the desktop app.

## Modal mode

When modal mode is activated, the desktop app turns into a smaller modal that is always on top and cannot be resized. This is done to improve the UX of performing a passkey operation (or SSH operation). Once the operation is completed, the app returns to normal mode and its previous position.

We are not using electron modal windows, for a couple reason. It would require us to send data in yet another layer of IPC, but also because we'd need to bootstrap entire renderer/app instead of reusing the existing window.

Some modal modes may hide the 'traffic buttons' (window controls) due to design requirements.
