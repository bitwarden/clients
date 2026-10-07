//! Caller attestation (W2a): best-effort parent-chain walk + code-signature verification for
//! the local listener's peer.
//!
//! See agent-access-architecture.md's "Attestation model (W2a)" for the contract this
//! implements. Two steps, both run from [`attest`]:
//!
//! 1. [`resolve_parent`] walks exactly **one level** up the process tree from the peer PID (the
//!    `aac` CLI, captured at accept time by `local_listener`). The wrinkle this exists for
//!    (agent-access-desktop-plan.md, "W2 — Caller attestation") is that the socket peer is always
//!    `aac`, a short-lived subprocess — the thing worth showing the user is whoever *spawned* `aac`
//!    (the agent), not `aac` itself.
//! 2. `verify_signature` (platform-specific, defined per-`cfg` below) checks the code signature of
//!    the **attested** process — the resolved parent if one was found, else the immediate peer —
//!    and produces a [`SignatureInfo`].
//!
//! # This is defense-in-depth, not a boundary
//!
//! Both steps are inherently racy and both are best-effort:
//! - The parent identified in step 1 can exit between the walk and the approval dialog being shown
//!   to the user. A signature verified in step 2 attests "this was the parent process at request
//!   time", never "this is still running and safe."
//! - Same-user malware can inject into or ptrace a legitimately-signed process (absent hardened
//!   runtime), or simply wait for the user to approve a request and scrape the result.
//!
//! Dialog copy built from this data must say only what was verified ("signed by X" / "at path
//! Y"), never "this is safe" — see agent-access-architecture.md's closing paragraph. A
//! long-lived MCP-server integration (plan §W2, option 1) would remove the parent-walk race
//! entirely by attesting a stable peer directly; that's out of scope for this CLI-subprocess v1.
//!
//! # Blocking
//!
//! Every OS call in this module is synchronous/blocking (`sysinfo` process refresh; macOS
//! `SecCode` validation; Windows `verifysign`/WinTrust). [`attest`] must only ever be invoked
//! from `tokio::task::spawn_blocking` — see `local_listener`'s call site — never directly on an
//! async task.
//!
//! # Never panics
//!
//! A hostile or merely-already-exited peer must never be able to crash the desktop app's main
//! process. Every fallible OS/FFI call here degrades to `None` / `valid: false` rather than
//! unwrapping or propagating a panic.

use sysinfo::{Pid, ProcessesToUpdate, System};

use crate::peer_info::LocalPeerInfo;

/// Best-effort identification of the immediate peer's parent process (exactly one level up the
/// process tree, resolved after the peer PID is already known from OS-verified peer
/// credentials). `None` on [`LocalPeerInfo::parent`] means resolution failed or the walk hit
/// `launchd`/`init` — see [`resolve_parent`]'s docs — not that the peer is untrusted.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParentProcessInfo {
    pub pid: u32,
    pub process_name: Option<String>,
    pub exe_path: Option<String>,
}

/// Which platform mechanism produced a [`SignatureInfo`], and therefore how to read `identity`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignatureKind {
    /// macOS: `identity` is `"TEAMID:signingIdentifier"`, or just the signing identifier alone
    /// for platform binaries signed without a team ID.
    MacosTeamId,
    /// Windows: `identity` is the Authenticode leaf certificate's subject common name.
    WindowsPublisher,
    /// Linux: no verification is performed; `identity` is the canonical `/proc/<pid>/exe` path.
    LinuxPathOnly,
}

/// Code-signature facts about the attested process (the resolved parent, or the immediate peer
/// if no parent resolved) — see [`attest`]. An unsigned or invalid-signature binary still
/// produces a `Some(SignatureInfo)`, with `valid: false` and the best available `identity`
/// (falling back to the executable path) — `None` on [`LocalPeerInfo::signature`] is reserved
/// for "verification could not be attempted at all" (e.g. the process already exited).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignatureInfo {
    pub kind: SignatureKind,
    pub identity: String,
    pub valid: bool,
}

/// Runs the parent-chain walk and code-signature verification for `peer` and returns it with
/// [`LocalPeerInfo::parent`] / [`LocalPeerInfo::signature`] populated. See the module docs for
/// the blocking and never-panics contracts this must uphold.
pub(crate) fn attest(mut peer: LocalPeerInfo) -> LocalPeerInfo {
    let parent = resolve_parent(peer.pid);

    let (attested_pid, attested_exe_path) = match &parent {
        Some(p) => (p.pid, p.exe_path.clone()),
        None => (peer.pid, peer.exe_path.clone()),
    };

    peer.signature = verify_signature(attested_pid, attested_exe_path.as_deref());
    peer.parent = parent;
    peer
}

/// Walks exactly one level up the process tree from `pid` (the local listener's peer, i.e. the
/// `aac` CLI). Returns `None` when:
/// - `pid` itself can no longer be resolved (it already exited),
/// - the OS reports no parent, or
/// - the parent is pid 0 or 1 (`launchd` on macOS, `init`/PID 1 on Linux, the reaper any orphaned
///   process gets reparented to). That means the *real* parent (the agent) already exited before
///   this walk ran, so there is nothing meaningful left to attest one level up — attesting the
///   reaper process would be actively misleading, not merely absent.
///
/// This is a single, best-effort hop, never a recursive walk — see the module docs' "This is
/// defense-in-depth, not a boundary" section for why going further (or retrying) wouldn't make
/// the result any less racy.
fn resolve_parent(pid: u32) -> Option<ParentProcessInfo> {
    let mut system = System::new();
    system.refresh_processes(ProcessesToUpdate::Some(&[Pid::from_u32(pid)]), true);
    let parent_pid = system.process(Pid::from_u32(pid))?.parent()?;

    if parent_pid.as_u32() <= 1 {
        return None;
    }

    system.refresh_processes(ProcessesToUpdate::Some(&[parent_pid]), true);
    let parent = system.process(parent_pid)?;
    Some(ParentProcessInfo {
        pid: parent_pid.as_u32(),
        process_name: parent.name().to_str().map(str::to_string),
        exe_path: parent.exe().and_then(|p| p.to_str()).map(str::to_string),
    })
}

// ---------------------------------------------------------------------------------------------
// Platform-specific signature verification.
//
// All three variants share the signature `fn(pid: u32, exe_path: Option<&str>) ->
// Option<SignatureInfo>` so `attest()` above needs no `cfg` of its own.
// ---------------------------------------------------------------------------------------------

/// macOS: verifies the code signature of the *running* process at `pid` via `SecCode`'s dynamic
/// (by-PID) API, preferred over `SecStaticCode`'s by-path API because it attests the process
/// that is actually running rather than merely a file at rest — see
/// agent-access-architecture.md. Falls back to the resolved `exe_path` for `identity` only when
/// no signing identifier/team ID can be read (unsigned binary, or the OS declined to hand back
/// signing info).
#[cfg(target_os = "macos")]
fn verify_signature(pid: u32, exe_path: Option<&str>) -> Option<SignatureInfo> {
    use std::ffi::c_void;

    use core_foundation::{
        base::TCFType,
        dictionary::{CFDictionary, CFDictionaryRef},
        string::CFStringRef,
    };
    use security_framework::os::macos::code_signing::{Flags, GuestAttributes, SecCode};
    use security_framework_sys::code_signing::{SecCodeCheckValidity, SecCodeRef};

    // Not exposed by `security-framework-sys` 2.17.0's `code_signing` module — declared
    // directly against Security.framework, matching Apple's `<Security/SecCode.h>` header.
    #[link(name = "Security", kind = "framework")]
    extern "C" {
        static kSecCodeInfoIdentifier: CFStringRef;
        static kSecCodeInfoTeamIdentifier: CFStringRef;
        static kSecCodeInfoCertificates: CFStringRef;

        fn SecCodeCopySigningInformation(
            code: SecCodeRef,
            flags: u32,
            information: *mut CFDictionaryRef,
        ) -> i32;
    }

    /// Apple's `kSecCSSigningInformation` (`<Security/CSCommon.h>`, `1 << 1`): requests the
    /// signing identifier and certificate chain in the returned dictionary. Not present in
    /// `security-framework-sys` 2.17.0's flag set.
    const SIGNING_INFORMATION: u32 = 1 << 1;

    let fallback_identity = || exe_path.unwrap_or_default().to_string();

    let pid_t_val = libc::pid_t::try_from(pid).ok()?;
    let mut attrs = GuestAttributes::new();
    attrs.set_pid(pid_t_val);

    // If the peer has already exited (the race window documented on `resolve_parent`), this
    // simply yields `None` — there is no code object left to ask about.
    let code = SecCode::copy_guest_with_attribues(None, &attrs, Flags::NONE).ok()?;

    // SAFETY: `code` holds a live, non-null `SecCodeRef` for the duration of this call (backed
    // by `code`, which is not dropped until this function returns). Passing a null requirement
    // asks `SecCodeCheckValidity` to perform only the code's own basic dynamic-validity/tamper
    // check, per Apple's documentation, rather than validating against a specific requirement
    // string we don't have one of.
    let valid = unsafe {
        SecCodeCheckValidity(
            code.as_concrete_TypeRef(),
            Flags::NONE.bits(),
            std::ptr::null_mut(),
        )
    } == 0;

    let mut info_ref: CFDictionaryRef = std::ptr::null();
    // SAFETY: `code` is a valid `SecCodeRef`. `info_ref` is a stack out-param: on success the
    // callee writes a newly `+1`-retained `CFDictionaryRef` into it; on failure it is left
    // untouched, so it is only read below after checking the returned status.
    let status = unsafe {
        SecCodeCopySigningInformation(
            code.as_concrete_TypeRef(),
            SIGNING_INFORMATION,
            &mut info_ref,
        )
    };
    if status != 0 || info_ref.is_null() {
        // Unsigned, or the OS declined to hand back signing info: still worth reporting that
        // the process was found and checked, with no identity beyond its path.
        return Some(SignatureInfo {
            kind: SignatureKind::MacosTeamId,
            identity: fallback_identity(),
            valid,
        });
    }
    // SAFETY: `info_ref` was just confirmed non-null and, per `SecCodeCopySigningInformation`'s
    // contract, is a `+1`-retained dictionary — `wrap_under_create_rule` (no extra retain) is
    // the matching ownership transfer; the resulting `CFDictionary` releases it on drop.
    let info =
        unsafe { CFDictionary::<*const c_void, *const c_void>::wrap_under_create_rule(info_ref) };

    // SAFETY: reading `extern` static `CFStringRef` constants owned by Security.framework —
    // valid for the lifetime of the process, per the framework's contract for these symbols.
    let (identifier_key, team_id_key, certificates_key) = unsafe {
        (
            kSecCodeInfoIdentifier,
            kSecCodeInfoTeamIdentifier,
            kSecCodeInfoCertificates,
        )
    };
    let identifier = cf_dict_string(&info, identifier_key);
    let team_id = cf_dict_string(&info, team_id_key);

    // An ad-hoc signature (`codesign -s -`, the linker's default on Apple Silicon, typical for
    // Homebrew builds) has no certificate chain, so its signing identifier is whatever the signer
    // chose and `SecCodeCheckValidity` still passes. Treat it as path-only: not `valid`, and
    // identified by its canonical executable path so a binary elsewhere that copies the
    // identifier cannot share a grant key. Apple platform binaries have no team ID but do carry
    // a certificate chain, so they keep their identifier.
    if cf_dict_array_len(&info, certificates_key).unwrap_or(0) == 0 {
        let path = exe_path
            .and_then(|p| std::fs::canonicalize(p).ok())
            .and_then(|p| p.to_str().map(str::to_string))
            .unwrap_or_else(fallback_identity);
        return Some(SignatureInfo {
            kind: SignatureKind::MacosTeamId,
            identity: path,
            valid: false,
        });
    }

    let identity = match (team_id, identifier) {
        (Some(team), Some(id)) => format!("{team}:{id}"),
        (Some(team), None) => team,
        (None, Some(id)) => id,
        (None, None) => fallback_identity(),
    };

    Some(SignatureInfo {
        kind: SignatureKind::MacosTeamId,
        identity,
        valid,
    })
}

/// Reads a `CFString`-valued entry out of a signing-information dictionary, if present.
#[cfg(target_os = "macos")]
fn cf_dict_string(
    dict: &core_foundation::dictionary::CFDictionary<
        *const std::ffi::c_void,
        *const std::ffi::c_void,
    >,
    key: core_foundation::string::CFStringRef,
) -> Option<String> {
    use core_foundation::{base::TCFType, string::CFString};

    let value: *const std::ffi::c_void = *dict.find(key.cast::<std::ffi::c_void>())?;
    if value.is_null() {
        return None;
    }
    // SAFETY: `value` is a "get rule" (borrowed, not owned) pointer into `dict`'s live storage —
    // valid because `dict` outlives this call — and both `kSecCodeInfoIdentifier` and
    // `kSecCodeInfoTeamIdentifier` are documented to map to `CFString` values when present.
    let value = unsafe { CFString::wrap_under_get_rule(value.cast()) };
    Some(value.to_string())
}

/// Length of a `CFArray`-valued entry in a signing-information dictionary, if present and an
/// array.
#[cfg(target_os = "macos")]
fn cf_dict_array_len(
    dict: &core_foundation::dictionary::CFDictionary<
        *const std::ffi::c_void,
        *const std::ffi::c_void,
    >,
    key: core_foundation::string::CFStringRef,
) -> Option<usize> {
    use core_foundation::{
        array::CFArray,
        base::{CFType, TCFType},
    };

    let value: *const std::ffi::c_void = *dict.find(key.cast::<std::ffi::c_void>())?;
    if value.is_null() {
        return None;
    }
    // SAFETY: `value` is a "get rule" (borrowed) pointer into `dict`'s live storage, valid
    // because `dict` outlives this call. It is wrapped as a generic `CFType` and only treated as
    // an array after a checked type-id downcast.
    let value = unsafe { CFType::wrap_under_get_rule(value.cast()) };
    let array = value.downcast::<CFArray<*const std::ffi::c_void>>()?;
    usize::try_from(array.len()).ok()
}

/// Windows: Authenticode publisher verification on the resolved executable path, mirroring
/// `chromium_importer/src/chromium/platform/windows/signature.rs`'s use of the same
/// `verifysign` crate/pin. Developed and reviewed on macOS — this path cannot be exercised
/// locally; kept intentionally minimal and structurally close to the existing precedent rather
/// than introducing novel logic here.
#[cfg(windows)]
fn verify_signature(_pid: u32, exe_path: Option<&str>) -> Option<SignatureInfo> {
    let path = exe_path?;
    let fallback_identity = || path.to_string();

    let result =
        verifysign::CodeSignVerifier::for_file(path).and_then(verifysign::CodeSignVerifier::verify);
    match result {
        Ok(ctx) => Some(SignatureInfo {
            kind: SignatureKind::WindowsPublisher,
            identity: ctx
                .subject_name()
                .common_name
                .unwrap_or_else(fallback_identity),
            valid: true,
        }),
        Err(_) => Some(SignatureInfo {
            kind: SignatureKind::WindowsPublisher,
            identity: fallback_identity(),
            valid: false,
        }),
    }
}

/// Linux: no signature verification is available — only the canonical executable path, per
/// agent-access-architecture.md's documented weaker guarantee for this platform.
///
/// Resolves via `/proc/<pid>/exe`, a kernel-maintained symlink to the file the running process
/// was actually `exec`'d from, rather than `exe_path` (the path `sysinfo` reported when
/// `LocalPeerInfo` was resolved). `exe_path` is attacker-influenceable in principle — it's a
/// string read from `/proc/<pid>/status`-family files that could, on an adversarial or racy
/// system, no longer match what's actually running by the time this runs — so canonicalizing
/// *it* would validate a path that was never confirmed to be the live process's own binary.
/// `/proc/<pid>/exe` is the kernel's own answer to "what is this pid actually running", making
/// it the authoritative source; `exe_path` is kept only as a fallback for when `/proc` isn't
/// available at all (sandboxing, or the process already exited between attestation steps).
///
/// If the on-disk file backing `/proc/<pid>/exe` has been deleted since exec (a real, if
/// unusual, situation — e.g. a self-updating binary that replaces itself), the kernel appends
/// `" (deleted)"` to the link target. That's preserved as-is rather than stripped: it's an
/// honest, informative signal ("this process's on-disk binary no longer exists") that dialog
/// copy built from `identity` should be able to reflect, not a formatting quirk to hide.
#[cfg(target_os = "linux")]
fn verify_signature(pid: u32, exe_path: Option<&str>) -> Option<SignatureInfo> {
    let identity = std::fs::read_link(format!("/proc/{pid}/exe"))
        .ok()
        .and_then(|p| p.to_str().map(str::to_string))
        .or_else(|| {
            exe_path.map(|path| {
                std::fs::canonicalize(path)
                    .ok()
                    .and_then(|p| p.to_str().map(str::to_string))
                    .unwrap_or_else(|| path.to_string())
            })
        })?;
    Some(SignatureInfo {
        kind: SignatureKind::LinuxPathOnly,
        identity,
        valid: false,
    })
}

/// Any other non-macOS, non-Windows, non-Linux target (e.g. the BSDs): `/proc/<pid>/exe` isn't
/// guaranteed to exist even when a `procfs` is mounted, so this falls back to canonicalizing the
/// `sysinfo`-reported path — the same weaker (attacker-influenceable, see the Linux variant's
/// docs) guarantee this crate previously shipped for all non-macOS/Windows targets.
#[cfg(all(not(target_os = "macos"), not(windows), not(target_os = "linux")))]
fn verify_signature(_pid: u32, exe_path: Option<&str>) -> Option<SignatureInfo> {
    let path = exe_path?;
    let canonical = std::fs::canonicalize(path)
        .ok()
        .and_then(|p| p.to_str().map(str::to_string))
        .unwrap_or_else(|| path.to_string());
    Some(SignatureInfo {
        kind: SignatureKind::LinuxPathOnly,
        identity: canonical,
        valid: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_parent_of_a_spawned_child_resolves_to_this_test_process() {
        let mut child = std::process::Command::new("sleep")
            .arg("5")
            .spawn()
            .expect("`sleep` should be available in the test environment");

        let parent = resolve_parent(child.id());

        let parent = parent.expect("the spawned child's parent should resolve to this process");
        assert_eq!(parent.pid, std::process::id());
        let exe_path = parent
            .exe_path
            .expect("this test process's own exe path should resolve");
        assert!(
            exe_path.contains('/') || exe_path.contains('\\'),
            "expected a full path, got: {exe_path}"
        );

        let _ = child.kill();
        let _ = child.wait();
    }

    #[test]
    fn resolve_parent_of_a_nonexistent_pid_is_none() {
        assert!(resolve_parent(u32::MAX).is_none());
    }

    #[test]
    fn attest_never_panics_on_a_nonexistent_peer() {
        let peer = LocalPeerInfo {
            pid: u32::MAX,
            process_name: None,
            exe_path: None,
            parent: None,
            signature: None,
        };
        let attested = attest(peer);
        assert!(attested.parent.is_none());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_signature_of_a_spawned_apple_signed_binary_is_valid() {
        let mut child = std::process::Command::new("/bin/sleep")
            .arg("5")
            .spawn()
            .expect("/bin/sleep should exist on macOS");

        let signature = verify_signature(child.id(), Some("/bin/sleep"))
            .expect("a running, resolvable pid should yield signature info");

        assert_eq!(signature.kind, SignatureKind::MacosTeamId);
        assert!(
            signature.valid,
            "/bin/sleep should be validly signed by Apple"
        );
        assert!(
            !signature.identity.is_empty(),
            "expected a non-empty signing identifier for /bin/sleep"
        );

        let _ = child.kill();
        let _ = child.wait();
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_signature_of_the_current_process_uses_proc_exe_not_the_reported_path() {
        let pid = std::process::id();
        // Deliberately a bogus `exe_path`, to prove `/proc/<pid>/exe` — the kernel's own
        // answer — is authoritative, and the (attacker-influenceable) `sysinfo`-reported path
        // passed alongside it is never trusted while `/proc` is available.
        let signature = verify_signature(pid, Some("/nonexistent/spoofed/path"))
            .expect("a running, resolvable pid should yield signature info");

        assert_eq!(signature.kind, SignatureKind::LinuxPathOnly);
        assert!(
            !signature.valid,
            "Linux path-only attestation is never `valid`"
        );

        let expected = std::fs::read_link(format!("/proc/{pid}/exe")).unwrap();
        assert_eq!(signature.identity, expected.to_str().unwrap());
        assert_ne!(signature.identity, "/nonexistent/spoofed/path");
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_signature_falls_back_to_exe_path_when_proc_is_unavailable() {
        // A nonexistent pid means `/proc/<pid>/exe` can't be read at all — the fallback to the
        // (canonicalized) `exe_path` argument should still produce a result rather than `None`.
        let signature = verify_signature(u32::MAX, Some("/bin/sh"))
            .expect("the exe_path fallback should still produce signature info");
        assert_eq!(signature.kind, SignatureKind::LinuxPathOnly);
        assert!(!signature.identity.is_empty());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_signature_of_the_unsigned_test_binary_degrades_cleanly() {
        // The test binary itself is unsigned (or ad-hoc signed) in a typical `cargo test` run.
        // This must never error/panic — only ever degrade to `valid: false` or `None`.
        let pid = std::process::id();
        let exe_path = std::env::current_exe()
            .ok()
            .and_then(|p| p.to_str().map(str::to_string));

        let signature = verify_signature(pid, exe_path.as_deref());

        if let Some(signature) = signature {
            assert_eq!(signature.kind, SignatureKind::MacosTeamId);
            // No assertion on `valid` — a locally-signed dev toolchain could plausibly sign the
            // test binary. The only real assertion is "this returned instead of panicking".
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_ad_hoc_signature_is_path_only_and_not_valid() {
        // Copy an Apple binary and re-sign the copy ad hoc, keeping Apple's signing identifier:
        // exactly what a forged `openshell-gateway` would do. It must not be reported valid, and
        // its identity must be its own path, not the borrowed identifier.
        let dir = std::env::temp_dir().join(format!("aa-adhoc-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("mkdir");
        let copy = dir.join("sleep");
        std::fs::copy("/bin/sleep", &copy).expect("copy");
        let signed = std::process::Command::new("/usr/bin/codesign")
            .args(["--force", "-s", "-", "-i", "com.apple.sleep"])
            .arg(&copy)
            .status()
            .expect("codesign runs");
        assert!(signed.success());
        let mut child = std::process::Command::new(&copy)
            .arg("5")
            .spawn()
            .expect("spawn");
        let copy_path = copy.to_str().expect("utf-8").to_string();
        let signature = verify_signature(child.id(), Some(&copy_path));
        let _ = child.kill();
        let _ = child.wait();
        let _ = std::fs::remove_dir_all(&dir);

        let signature = signature.expect("signature info");
        assert!(!signature.valid, "ad-hoc must not be reported valid");
        assert_ne!(signature.identity, "com.apple.sleep");
        assert!(
            signature.identity.ends_with("/sleep"),
            "{}",
            signature.identity
        );
    }
}
