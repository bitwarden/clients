//! Signer lookup by pid via the dynamic SecCode API (the running process, not the file on disk).

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

use super::{Signer, SignerInfo, SignerKind};

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

    // SAFETY: `code` is live; a null requirement checks only the signature itself.
    let status = unsafe {
        SecCodeCheckValidity(
            code.as_concrete_TypeRef(),
            Flags::NONE.bits(),
            std::ptr::null_mut(),
        )
    };
    let satisfies = |req: &str| {
        req.parse::<SecRequirement>()
            .is_ok_and(|req| code.check_validity(Flags::NONE, &req).is_ok())
    };
    let kind = match summary {
        None => SignerKind::AdHoc,
        Some(_) if satisfies(DEVELOPER_ID) => SignerKind::DeveloperId,
        Some(_) if satisfies("anchor apple") => SignerKind::Platform,
        Some(_) => SignerKind::Other,
    };
    let (id, organization) = match kind {
        SignerKind::DeveloperId => (team, summary.as_deref().and_then(organization)),
        SignerKind::Platform => (Some(identifier.clone()), Some("Apple".to_string())),
        // A self-signed subject and team id are whatever the signer typed.
        SignerKind::AdHoc | SignerKind::Other => (None, None),
    };
    let valid = status == 0;
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

/// sysinfo's `PROC_PIDTBSDINFO` is same-user only, so it loses the parent of setuid `login`;
/// `PROC_PIDT_SHORTBSDINFO` is not.
pub(super) fn ppid(pid: u32) -> Option<u32> {
    const PROC_PIDT_SHORTBSDINFO: i32 = 13;
    // `struct proc_bsdshortinfo`: 64 bytes, `pbsi_ppid` second.
    let mut info = [0u32; 16];
    let pid = i32::try_from(pid).ok()?;
    // SAFETY: `info` is exactly the 64 bytes the call is told it may write.
    let written =
        unsafe { libc::proc_pidinfo(pid, PROC_PIDT_SHORTBSDINFO, 0, info.as_mut_ptr().cast(), 64) };
    (written == 64 && info[1] > 0).then_some(info[1])
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
