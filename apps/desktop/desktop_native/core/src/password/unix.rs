use anyhow::{anyhow, Result};
use oo7::dbus::{self};
use std::collections::HashMap;

pub async fn get_password(service: &str, account: &str) -> Result<String> {
    match get_password_new(service, account).await {
        Ok(res) => Ok(res),
        Err(_) => get_password_legacy(service, account).await,
    }
}

async fn get_password_new(service: &str, account: &str) -> Result<String> {
    let keyring = oo7::Keyring::new().await?;
    let _ = try_prompt(&keyring).await;
    let attributes = HashMap::from([("service", service), ("account", account)]);
    let results = keyring.search_items(&attributes).await?;
    let res = results.first();
    match res {
        Some(res) => {
            let secret = res.secret().await?;
            Ok(String::from_utf8(secret.to_vec())?)
        }
        None => Err(anyhow!("no result")),
    }
}

// forces to read via secret service; remvove after 2025.03
async fn get_password_legacy(service: &str, account: &str) -> Result<String> {
    println!("falling back to get legacy {} {}", service, account);
    let svc = dbus::Service::new().await?;
    let collection = svc.default_collection().await?;
    let keyring = oo7::Keyring::DBus(collection);
    let _ = try_prompt(&keyring).await;
    let attributes = HashMap::from([("service", service), ("account", account)]);
    let results = keyring.search_items(&attributes).await?;
    let res = results.first();
    match res {
        Some(res) => {
            let secret = res.secret().await?;
            println!(
                "deleting legacy secret service entry {} {}",
                service, account
            );
            keyring.delete(&attributes).await?;
            let secret_string = String::from_utf8(secret.to_vec())?;
            set_password(service, account, &secret_string).await?;
            Ok(secret_string)
        }
        None => Err(anyhow!("no result")),
    }
}

pub async fn set_password(service: &str, account: &str, password: &str) -> Result<()> {
    let keyring = oo7::Keyring::new().await?;
    let _ = try_prompt(&keyring).await;
    let attributes = HashMap::from([("service", service), ("account", account)]);
    keyring
        .create_item(
            "org.freedesktop.Secret.Generic",
            &attributes,
            password,
            true,
        )
        .await?;
    Ok(())
}

/// Remove a credential from the OS keyring. This function will *not* automatically
/// prompt the user to unlock their keyring. If the keyring is locked when this
/// is called, it will fail silently.
pub async fn delete_password(service: &str, account: &str) -> Result<()> {
    // We need to silently fail in the event that the user's keyring was
    // locked while our application was in-use. Otherwise, when we
    // force a de-auth because we can't access keys in secure storage,
    // kwallet will notify the user that an application is "misbehaving". This
    // seems to happen because we call [delete_password] many times when a forced
    // de-auth occurs to clean up old keys.
    if is_locked().await? {
        println!("skipping deletion of old keys. OS keyring is locked.");
        return Ok(());
    }

    let keyring = oo7::Keyring::new().await?;
    let attributes = HashMap::from([("service", service), ("account", account)]);
    keyring.delete(&attributes).await?;
    Ok(())
}

/// Sends an OS notification prompt for the user to unlock/allow the application
/// to read and write keys.
async fn try_prompt(keyring: &oo7::Keyring) -> bool {
    keyring.unlock().await.is_ok()
}

/// Keyrings on Linux cannnot be assumed to be unlocked while the user is
/// logged in to a desktop session. Therefore, before reading or writing
/// keys, you should check if the keyring is unlocked, and call
/// [try_prompt] if ignoring the lock state is not an option.
pub async fn is_locked() -> Result<bool> {
    let keyring = oo7::Keyring::new().await?;

    // No simple way to check keyring lock state, so we just try to list items
    let items = keyring.items().await?;
    if let Some(item) = items.first() {
        return match item.is_locked().await {
            Ok(is_locked) => {
                println!("OS keyring is locked = {is_locked}");
                Ok(is_locked)
            }
            Err(_) => {
                println!("OS keyring is unlocked");
                Ok(false)
            }
        };
    }

    // assume it's locked
    Ok(true)
}

/// This will return true if a keyring is configured. However, on Linux, it does
/// NOT indicate if the keyring is _unlocked_. Use [is_locked] to check
/// the lock state before reading or writing keys.
pub async fn is_available() -> Result<bool> {
    match oo7::Keyring::new().await {
        Ok(_) => Ok(true),
        _ => Ok(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test() {
        set_password("BitwardenTest", "BitwardenTest", "Random")
            .await
            .unwrap();
        assert_eq!(
            "Random",
            get_password("BitwardenTest", "BitwardenTest")
                .await
                .unwrap()
        );
        delete_password("BitwardenTest", "BitwardenTest")
            .await
            .unwrap();

        // Ensure password is deleted
        match get_password("BitwardenTest", "BitwardenTest").await {
            Ok(_) => {
                panic!("Got a result")
            }
            Err(e) => assert_eq!("no result", e.to_string()),
        }
    }

    #[tokio::test]
    async fn test_error_no_password() {
        match get_password("Unknown", "Unknown").await {
            Ok(_) => panic!("Got a result"),
            Err(e) => assert_eq!("no result", e.to_string()),
        }
    }
}
