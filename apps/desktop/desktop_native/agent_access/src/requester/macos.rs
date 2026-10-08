//! Process table via libproc, which works inside the App Store sandbox and across users, and
//! signer lookup via the dynamic SecCode API (the running process, not the file on disk).

use std::ffi::c_void;

use core_foundation::{
    array::CFArray,
    base::{CFType, TCFType},
    dictionary::{CFDictionary, CFDictionaryRef},
    string::{CFString, CFStringRef},
    ConcreteCFType,
};
use security_framework::{
    certificate::SecCertificate,
    os::macos::code_signing::{Flags, GuestAttributes, SecCode, SecRequirement},
};
use security_framework_sys::code_signing::{SecCodeCheckValidity, SecCodeRef};

use super::{ProcessEntry, Signer, SignerInfo, SignerKind};

// Missing from security-framework-sys. The keys are immutable framework constants.
#[link(name = "Security", kind = "framework")]
unsafe extern "C" {
    safe static kSecCodeInfoIdentifier: CFStringRef;
    safe static kSecCodeInfoTeamIdentifier: CFStringRef;
    safe static kSecCodeInfoCertificates: CFStringRef;
    safe static kSecCodeInfoPList: CFStringRef;
    fn SecCodeCopySigningInformation(
        code: SecCodeRef,
        flags: u32,
        info: *mut CFDictionaryRef,
    ) -> i32;
}

/// `kSecCSSigningInformation`.
const SIGNING_INFORMATION: u32 = 1 << 1;
/// `errSecCSReqFailed`: the signature is valid but doesn't meet the requirement.
const REQ_FAILED: i32 = -67050;
const DEVELOPER_ID: &str =
    "anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] \
     exists and certificate leaf[field.1.2.840.113635.100.6.1.13] exists";

pub(super) fn signer(pid: u32) -> Option<SignerInfo> {
    let mut attrs = GuestAttributes::new();
    attrs.set_pid(libc::pid_t::try_from(pid).ok()?);
    let code = SecCode::copy_guest_with_attribues(None, &attrs, Flags::NONE).ok()?;

    let mut info_ref: CFDictionaryRef = std::ptr::null();
    // SAFETY: `code` is live; `info_ref` is only read after a success status.
    let status = unsafe {
        SecCodeCopySigningInformation(
            code.as_concrete_TypeRef(),
            SIGNING_INFORMATION,
            &mut info_ref,
        )
    };
    if status != 0 || info_ref.is_null() {
        return None;
    }
    // SAFETY: non-null +1 dictionary from a Copy function; released on drop.
    let info = unsafe { CFDictionary::wrap_under_create_rule(info_ref) };

    // Unsigned code has no identifier.
    let identifier = get::<CFString>(&info, kSecCodeInfoIdentifier)?.to_string();
    let team = get::<CFString>(&info, kSecCodeInfoTeamIdentifier).map(|s| s.to_string());
    let summary = get::<CFArray>(&info, kSecCodeInfoCertificates)
        .and_then(|certs| certs.get(0).map(|c| *c))
        .filter(|c| !c.is_null())
        // SAFETY: get-rule pointer kept alive by `info`; retained by the wrap.
        .and_then(|c| unsafe { CFType::wrap_under_get_rule(c) }.downcast::<SecCertificate>())
        .map(|leaf| leaf.subject_summary());
    let plist = get::<CFDictionary>(&info, kSecCodeInfoPList);
    let bundle_name = ["CFBundleDisplayName", "CFBundleName"]
        .into_iter()
        .find_map(|key| {
            let key = CFString::from_static_string(key);
            Some(get::<CFString>(plist.as_ref()?, key.as_concrete_TypeRef())?.to_string())
        });

    // Each check also validates the signature, so most processes need only one.
    let check = |req: &str| {
        let req = req.parse::<SecRequirement>().map_err(|e| e.code())?;
        code.check_validity(Flags::NONE, &req).map_err(|e| e.code())
    };
    let (kind, valid) = match summary {
        // SAFETY: `code` is live; a null requirement checks only the signature itself.
        None => (SignerKind::AdHoc, unsafe {
            SecCodeCheckValidity(
                code.as_concrete_TypeRef(),
                Flags::NONE.bits(),
                std::ptr::null_mut(),
            ) == 0
        }),
        Some(_) => match check(DEVELOPER_ID) {
            Ok(()) => (SignerKind::DeveloperId, true),
            Err(REQ_FAILED) if check("anchor apple").is_ok() => (SignerKind::Platform, true),
            Err(REQ_FAILED) => (SignerKind::Other, true),
            Err(_) => (SignerKind::Other, false),
        },
    };
    let (id, organization) = match kind {
        SignerKind::DeveloperId => (team, summary.as_deref().and_then(organization)),
        SignerKind::Platform => (Some(identifier.clone()), Some("Apple".to_string())),
        // A self-signed subject and team id are whatever the signer typed.
        SignerKind::AdHoc | SignerKind::Other => (None, None),
    };
    let signer = Signer {
        kind,
        id,
        organization,
        valid,
    };
    Some(SignerInfo {
        signer,
        identifier: Some(identifier),
        bundle_name,
    })
}

/// `PROC_PIDT_SHORTBSDINFO`, unlike sysinfo's `PROC_PIDTBSDINFO`, also reads setuid `login`.
pub(super) fn process(pid: u32) -> Option<ProcessEntry> {
    const PROC_PIDT_SHORTBSDINFO: i32 = 13;
    // `struct proc_bsdshortinfo`: `pbsi_ppid` at 4, `pbsi_comm[16]` at 16.
    let mut info = [0u8; 64];
    let pid = i32::try_from(pid).ok()?;
    // SAFETY: `info` is exactly the 64 bytes the call is told it may write.
    let written =
        unsafe { libc::proc_pidinfo(pid, PROC_PIDT_SHORTBSDINFO, 0, info.as_mut_ptr().cast(), 64) };
    if written != 64 {
        return None;
    }
    let ppid = u32::from_ne_bytes(info[4..8].try_into().ok()?);
    let comm = info[16..32].split(|&b| b == 0).next()?;
    Some(ProcessEntry {
        ppid: (ppid > 0).then_some(ppid),
        name: String::from_utf8_lossy(comm).into_owned(),
        exe: exe(pid),
    })
}

fn exe(pid: i32) -> Option<String> {
    let mut path = vec![0u8; libc::PROC_PIDPATHINFO_MAXSIZE as usize];
    // SAFETY: `path` holds the `PROC_PIDPATHINFO_MAXSIZE` bytes the call may write.
    let written = unsafe { libc::proc_pidpath(pid, path.as_mut_ptr().cast(), path.len() as u32) };
    path.truncate(usize::try_from(written).ok().filter(|&n| n > 0)?);
    String::from_utf8(path).ok()
}

/// `Developer ID Application: Anthropic PBC (Q6L2SF6YDW)` → `Anthropic PBC`.
fn organization(summary: &str) -> Option<String> {
    // App Store apps are re-signed by Apple, so the leaf names Apple, not the publisher.
    if summary.starts_with("Apple Mac OS Application Signing") {
        return None;
    }
    let rest = summary.split_once(": ").map_or(summary, |(_, rest)| rest);
    let rest = rest
        .strip_suffix(')')
        .and_then(|r| r.rsplit_once('('))
        .filter(|(_, id)| {
            id.chars()
                .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
        })
        .map_or(rest, |(org, _)| org)
        .trim();
    (!rest.is_empty()).then(|| rest.to_string())
}

fn get<T: ConcreteCFType>(dict: &CFDictionary, key: CFStringRef) -> Option<T> {
    let value = *dict.find(key.cast::<c_void>())?;
    // SAFETY: non-null get-rule pointer kept alive by `dict`; retained by the wrap.
    (!value.is_null())
        .then(|| unsafe { CFType::wrap_under_get_rule(value) })?
        .downcast::<T>()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn organization_from_subject_summary() {
        let cases = [
            (
                "Developer ID Application: Anthropic PBC (Q6L2SF6YDW)",
                Some("Anthropic PBC"),
            ),
            (
                "Developer ID Application: Anthropic PBC",
                Some("Anthropic PBC"),
            ),
            ("Apple Development: Jane Doe (AB12CD34EF)", Some("Jane Doe")),
            (
                "Mitchell Hashimoto (24VZTF6M5V)",
                Some("Mitchell Hashimoto"),
            ),
            ("Acme (Europe) Ltd", Some("Acme (Europe) Ltd")),
            ("Apple Mac OS Application Signing", None),
            ("Developer ID Application: (Q6L2SF6YDW)", None),
            ("", None),
            (" : ", None),
        ];
        for (summary, expected) in cases {
            assert_eq!(organization(summary).as_deref(), expected, "{summary:?}");
        }
    }

    #[test]
    fn process_reads_this_process() {
        let entry = process(std::process::id()).expect("entry");
        let exe = std::env::current_exe().unwrap();
        assert_eq!(entry.exe.as_deref(), exe.to_str());
        assert_eq!(entry.ppid, Some(std::os::unix::process::parent_id()));
    }

    #[test]
    fn apple_binary_is_platform() {
        let mut child = std::process::Command::new("/bin/sleep")
            .arg("5")
            .spawn()
            .expect("spawn");
        let info = signer(child.id());
        let _ = child.kill();
        let _ = child.wait();
        let signer = info.expect("signer").signer;
        assert_eq!(signer.kind, SignerKind::Platform);
        assert_eq!(signer.id.as_deref(), Some("com.apple.sleep"));
        assert!(signer.valid);
    }
}
