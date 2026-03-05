#[macro_use]
extern crate napi_derive;

mod passkey_authenticator_internal;
mod registry;

// NAPI namespaces
// In each of these modules, the types are defined within a nested namespace of
// the same name so that NAPI can export the TypeScript types within a
// namespace.
pub mod autofill;
pub mod autostart;
pub mod autotype;
pub mod biometrics;
pub mod biometrics_v2;
pub mod chromium_importer;
pub mod clipboards;
pub mod ipc;
pub mod logging;
pub mod passkey_authenticator;
pub mod passwords;
pub mod powermonitors;
pub mod processisolations;
pub mod sshagent;
pub mod windows_registry;
