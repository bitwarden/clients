# dev-tools

Developer-only tooling shared across clients. These should be developer facing-only, and not
part of a regular users usage.

## Feature flag overrides

A dialog listing every boolean feature flag with **On / Off / Default** per flag. Selecting On or
Off writes a local override that `DefaultConfigService` already honours ahead of the server config;
Default clears it.

The entry point (web settings nav, browser settings list, desktop **View** menu) is shown if and
only if the client says it is a development build:

- web / browser: `ENV === "development"`
- desktop: a development build, or the app was started with `ENABLE_FEATURE_FLAG_OVERRIDE_MENU=true`

Outside a development build the entry is hidden. Calling `featureFlagMenu()` from the developer
console toggles it on or off; the choice is persisted, so it survives a restart.
