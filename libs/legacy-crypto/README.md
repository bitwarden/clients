# legacy-crypto

Owned by: key-management

Deprecated crypto primitives being retired in favour of the SDK.

## Do not import this package

`@bitwarden/legacy-crypto` is a **restricted import**, enforced by `no-restricted-imports` in the
root `eslint.config.mjs`. Nothing new may depend on it. If you need a cryptographic operation,
implement it in the SDK and/or contact the Key Management team.

Existing call sites will be migrated to it.

If you want to build a cryptographic feature, do not base it on the legacy crypto module.
Build an sdk shim instead, that exposes the functionality you need.
