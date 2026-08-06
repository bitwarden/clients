# dev-tools

Developer-only tooling shared across clients. These should be developer facing-only, and not
part of a regular users usage.

## Feature flag overrides

A dialog listing every boolean feature flag with **On / Off / Default** per flag. Selecting On or
Off writes a local override that `DefaultConfigService` already honours ahead of the server config;
Default clears it.

The entry point (web settings nav, browser settings list, desktop **View** menu) is only shown when
the override menu is enabled, which is true when any of:

- the build is a development build, or
- (desktop only) the app was started with `ENABLE_FEATURE_FLAG_OVERRIDE_MENU=true`, or
- `enableFeatureFlagOverrideMenu()` has been called from the developer console.

`disableFeatureFlagOverrideMenu()` turns it back off. The choice is persisted, so it survives a
restart in either direction.
