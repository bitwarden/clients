# File Scoped Security Access on Mac App Store Builds 
## Accessing filesystem entries outside of the app sandbox 

### TLDR
#### Build & run locally using `npm run electron:sandbox` 
#### `build-desktop.yml` section `macos-package-mas` was modified to support this in CI builds: 
```
      - name: Build Native Module
        if: steps.cache.outputs.cache-hit != 'true'
        working-directory: apps/desktop/desktop_native
        env:
          # required to bypass sandbox (MAS only)
          SANDBOX_BUILD: 1  
        run: node build.js cross-platform
```
### The Rust code uses a feature named `sandbox` that is used to conditionally compile almost all of the logic introduced in this PR: `#[cfg(all(target_os = "macos", feature = "sandbox"))]`

### How it works
- `apps/desktop/src/app/tools/import/chromium-importer.service.ts` serves as the entrypoint to this logic. __Regardless of the `SANDBOX_BUILD` env var__, this service will call `request_browser_access()` 
in `apps/desktop/desktop_native/napi/src/lib.rs` which returns an `Ok` unit variant (no-op) when the `sandbox` feature is not enabled. Outside of sandbox builds, `ChromiumImporterService` will avoid any of the logic added in this PR and continue the chromium importer workflow exactly as before.

- When the `sandbox` feature is enabled the call chain advances to `apps/desktop/desktop_native/chromium_importer/src/chromium/mod.rs` where another conditionally compiled (cfg gated) `request_browser_access()` function is defined. This function is used to advance the call chain into the platform specific (Mac OS) Rust code inside `apps/desktop/desktop_native/chromium_importer/src/chromium/platform/macos.rs`.

- When the `sandbox` feature is enabled, a series of cfg gated functions are used in this file to interface with native Objective-C bridges and Swift code responsible for requesting access to browser specific directories. 

- `request_only()` is responsible for requesting access to a given browser's directory AND creating the security scoped bookmark, the mechanism Mac uses to persist these kinds of permissions. It corresponds to `requestAccessToBroswerDir()` in the file `apps/desktop/desktop_native/objc/src/native/chromium_importer/browser_access.swift`. This Swift code will determine the appropriate directory to request access to, based upon the browser name passed as argument, and will then display an `NSOpenPanel` with a message instructing the user to select the browser's directory where profile information is stored. 

- `resume()` is responsible for determining if a security scoped bookmark exists and is valid, if so, it will be used to access the browser directory. 

- `request_and_start()` encapsulates both of the functions described above into a single function call. 

- `has_stored_access()` and `drop()` are self-explanatory helper functions. 

- See directory `apps/desktop/desktop_native/objc/src/native/chromium_importer` for the native Objective-C and Swift code. Instead of removing debug output I've commented out `NSLog` statements since they may be useful in the future. 