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

pub async fn delete_password(service: &str, account: &str) -> Result<()> {
    let keyring = oo7::Keyring::new().await?;
    let attributes = HashMap::from([("service", service), ("account", account)]);
    keyring.delete(&attributes).await?;
    Ok(())
}

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
