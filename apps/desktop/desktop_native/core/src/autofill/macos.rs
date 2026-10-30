use anyhow::Result;
use core_foundation::{
    base::{CFAllocatorRef, CFType, CFTypeRef, TCFType},
    boolean::CFBoolean,
    error::CFErrorRef,
    string::{CFString, CFStringRef},
};

/// The entitlement that allows the app to act as a credential provider.
const CREDENTIAL_PROVIDER_ENTITLEMENT: &str =
    "com.apple.developer.authentication-services.autofill-credential-provider";

#[repr(C)]
struct SecTask(std::ffi::c_void);
type SecTaskRef = *const SecTask;

#[link(name = "Security", kind = "framework")]
extern "C" {
    fn SecTaskCreateFromSelf(allocator: CFAllocatorRef) -> SecTaskRef;
    fn SecTaskCopyValueForEntitlement(
        task: SecTaskRef,
        entitlement: CFStringRef,
        error: *mut CFErrorRef,
    ) -> CFTypeRef;
}

pub async fn run_command(value: String) -> Result<String> {
    desktop_objc::run_command(value).await
}

/// Whether the running app has the credential provider entitlement.
pub fn has_credential_provider_entitlement() -> bool {
    let entitlement = CFString::new(CREDENTIAL_PROVIDER_ENTITLEMENT);
    // SAFETY: The task is created and released here. The returned value follows the create rule,
    // so ownership is transferred to `CFType`, which releases it on drop.
    unsafe {
        let task = SecTaskCreateFromSelf(std::ptr::null());
        if task.is_null() {
            return false;
        }
        let value = SecTaskCopyValueForEntitlement(
            task,
            entitlement.as_concrete_TypeRef(),
            std::ptr::null_mut(),
        );
        core_foundation::base::CFRelease(task.cast());
        if value.is_null() {
            return false;
        }
        CFType::wrap_under_create_rule(value)
            .downcast_into::<CFBoolean>()
            .is_some_and(bool::from)
    }
}
