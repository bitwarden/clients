/// Build the desktop proxy.
///
/// The proxy is the native helper that browsers talk to over native messaging. It is built for
/// every platform, and on macOS it is packaged twice -- as `desktop_proxy` and
/// `desktop_proxy.inherit`, with different entitlements -- from this one binary.
///
/// Usage:
///   node scripts/build-desktop-proxy.mts --build-dir build-mac

import { buildCargoBinary } from "./cargo-build.mts";

buildCargoBinary({ bin: "desktop_proxy", targetKey: "desktopProxy" });
