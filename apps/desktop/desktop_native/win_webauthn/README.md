Rust wrapper for the Windows WebAuthn Library.


Based on [microsoft/webauthn@c3ed95f][webauthn-ref], released in Windows 11
November 2025 update.

[webauthn-ref]: https://github.com/microsoft/webauthn/tree/c3ed95fd7603441a0253c55c14e79239cb556a9f

# Current Limitations

In this initial version, there are some limitations that need to be addressed:

- The `ErrorKind` enum is too broad. The use needs to be audited and more variants should be added for specific error cases.
- C structs for use in webauthn.dll functions are defined manually. As of
  [microsoft/windows-rs@95dfa93](https://github.com/microsoft/windows-rs/tree/95dfa93ce7a004449d5309b36dda9f2300f57db6),
  these are included in the `windows` crate, but there has not been a released
  version of that crate since it was added. As soon as it is released, we can
  update to it.
- We are not using the `dwVersion` fields of the structs and are instead
  hard-coding availability for all the structs as of the Windows 11 passkey plugin
  authenticator (November 2025). To make this more generally useful, we should
  read these fields and optionally omit known fields that were introduced in a
  higher version than `dwVersion` specifies (e.g., by returning an Option<T> for
  those fields).
- End-to-end tests for the plugin authenticator handler code would be good to
  include. We could consider using a Rust trait to wrap the FFI calls, or to
  create a DLL from a Rust cdylib that mocks the required webauthn.dll
  functionality and is called from the tests.