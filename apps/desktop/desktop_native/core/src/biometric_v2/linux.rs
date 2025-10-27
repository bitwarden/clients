//! This file implements Polkit based system unlock.
//!
//! # Security
//! This section describes the assumed security model and security guarantees achieved. In the required security
//! guarantee is that a locked vault - a running app - cannot be unlocked when the device (user-space)
//! is compromised in this state.
//!
//! When first unlocking the app, the app sends the user-key to this module, which holds it in secure memory,
//! protected by memfd_secret. This makes it inaccessible to other processes, even if they compromise root, a kernel compromise
//! has circumventable best-effort protections. While the app is running this key is held in memory, even if locked.
//! When unlocking, the app will prompt the user via `polkit` to get a yes/no decision on whether to release the key to the app.

use anyhow::{anyhow, Result};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, warn};
use zbus::Connection;
use zbus_polkit::policykit1::{AuthorityProxy, CheckAuthorizationFlags, Subject};

use crate::secure_memory::*;

pub struct BiometricLockSystem {
    // The userkeys that are held in memory MUST be protected from memory dumping attacks, to ensure
    // locked vaults cannot be unlocked
    secure_memory: Arc<Mutex<crate::secure_memory::encrypted_memory_store::EncryptedMemoryStore>>,
}

impl BiometricLockSystem {
    pub fn new() -> Self {
        Self {
            secure_memory: Arc::new(Mutex::new(crate::secure_memory::encrypted_memory_store::EncryptedMemoryStore::new())),
        }
    }
}

impl Default for BiometricLockSystem {
    fn default() -> Self {
        Self::new()
    }
}

impl super::BiometricTrait for BiometricLockSystem {
    async fn authenticate(&self, _hwnd: Vec<u8>, _message: String) -> Result<bool> {
        polkit_authenticate_bitwarden_policy().await
    }

    async fn authenticate_available(&self) -> Result<bool> {
        polkit_is_bitwarden_policy_available().await
    }

    async fn enroll_persistent(&self, _user_id: &str, _key: &[u8]) -> Result<()> {
        // Not implemented
        Ok(())
    }

    async fn provide_key(&self, user_id: &str, key: &[u8]) {
        self.secure_memory
            .lock()
            .await
            .put(user_id.to_string(), key);
    }

    async fn unlock(&self, user_id: &str, _hwnd: Vec<u8>) -> Result<Vec<u8>> {
        if !polkit_authenticate_bitwarden_policy().await? {
            return Err(anyhow!("Authentication failed"));
        }

        self.secure_memory
            .lock()
            .await
            .get(user_id)
            .ok_or(anyhow!("No key found"))
    }

    async fn unlock_available(&self, user_id: &str) -> Result<bool> {
        Ok(self.secure_memory.lock().await.has(user_id))
    }

    async fn has_persistent(&self, _user_id: &str) -> Result<bool> {
        Ok(false)
    }

    async fn unenroll(&self, user_id: &str) -> Result<(), anyhow::Error> {
        self.secure_memory.lock().await.remove(user_id);
        Ok(())
    }
}

/// Perform a polkit authorization against the bitwarden unlock policy. Note: This relies on no custom
/// rules in the system skipping the authorization check, in which case this counts as UV / authentication.
async fn polkit_authenticate_bitwarden_policy() -> Result<bool> {
    debug!("[Polkit] Authenticating / performing UV");

    let connection = Connection::system().await?;
    let proxy = AuthorityProxy::new(&connection).await?;
    let subject = Subject::new_for_owner(std::process::id(), None, None)?;
    let details = std::collections::HashMap::new();
    let authorization_result = proxy
        .check_authorization(
            &subject,
            "com.bitwarden.Bitwarden.unlock",
            &details,
            CheckAuthorizationFlags::AllowUserInteraction.into(),
            "",
        )
        .await;

    match authorization_result {
        Ok(result) => Ok(result.is_authorized),
        Err(e) => {
            warn!("[Polkit] Error performing authentication: {:?}", e);
            Ok(false)
        }
    }
}

async fn polkit_is_bitwarden_policy_available() -> Result<bool> {
    let connection = Connection::system().await?;
    let proxy = AuthorityProxy::new(&connection).await?;
    let actions = proxy.enumerate_actions("en").await?;
    for action in actions {
        if action.action_id == "com.bitwarden.Bitwarden.unlock" {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_polkit_authenticate() {
        let result = polkit_authenticate_bitwarden_policy().await;
        assert!(result.is_ok());
    }
}
